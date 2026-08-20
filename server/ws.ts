/**
 * Yjs WebSocket handler for Bun native WebSockets.
 * Handles collaborative document editing with awareness (cursors).
 *
 * Protocol:
 *   - Binary messages starting with byte 0 = sync
 *   - Binary messages starting with byte 1 = awareness
 */
import type { ServerWebSocket } from "bun";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

export type DocWS = ServerWebSocket<{ docId: string }>;

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

interface DocEntry {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<DocWS, Set<number>>; // ws -> set of awareness client IDs this conn controls
}

const docs = new Map<string, DocEntry>();

// Track which WS connection is currently being processed so we can
// exclude it from doc update broadcasts
let currentMessageOriginWs: DocWS | null = null;

function getOrCreateDoc(docName: string): DocEntry {
  if (docs.has(docName)) return docs.get(docName)!;

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  // *** CRITICAL: Broadcast doc updates to all OTHER connections ***
  // When readSyncMessage applies an update, Y.Doc fires 'update'.
  // We must forward that update to every other connected client.
  doc.on("update", (update: Uint8Array) => {
    const entry = docs.get(docName);
    if (!entry) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);

    entry.conns.forEach((_ids, conn) => {
      // Don't send the update back to the connection that sent it
      if (conn !== currentMessageOriginWs) {
        try { conn.send(msg); } catch { /* connection may have closed */ }
      }
    });
  });

  // Broadcast awareness changes to all EXCEPT origin
  awareness.on("update", (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: DocWS | null
  ) => {
    const changedClients = added.concat(updated, removed);
    const entry = docs.get(docName);
    if (!entry || changedClients.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const msg = encoding.toUint8Array(encoder);

    entry.conns.forEach((_ids, conn) => {
      if (conn !== origin) {
        try { conn.send(msg); } catch { /* noop */ }
      }
    });
  });

  const entry: DocEntry = { doc, awareness, conns: new Map() };
  docs.set(docName, entry);
  return entry;
}

function handleMessage(ws: DocWS, docName: string, data: ArrayBuffer | Uint8Array) {
  const entry = docs.get(docName);
  if (!entry) return;

  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const decoder = decoding.createDecoder(uint8);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MSG_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      // Set the origin WS so the doc 'update' handler can exclude it
      currentMessageOriginWs = ws;
      syncProtocol.readSyncMessage(decoder, encoder, entry.doc, ws);
      currentMessageOriginWs = null;
      // If readSyncMessage generated a reply (e.g. sync step 2), send it back
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
      break;
    }
    case MSG_AWARENESS: {
      const update = decoding.readVarUint8Array(decoder);

      // Track which client IDs this connection controls
      const connClientIds = entry.conns.get(ws);
      if (connClientIds) {
        try {
          const d = decoding.createDecoder(update);
          const n = decoding.readVarUint(d);
          for (let i = 0; i < n; i++) {
            const clientId = decoding.readVarUint(d);
            connClientIds.add(clientId);
            decoding.readVarUint(d);   // clock
            decoding.readVarString(d); // state JSON
          }
        } catch { /* parsing error, non-critical */ }
      }

      // Apply with `ws` as origin so awareness broadcast skips the sender
      awarenessProtocol.applyAwarenessUpdate(entry.awareness, update, ws);
      break;
    }
  }
}

function setupConnection(ws: DocWS, docName: string) {
  const entry = getOrCreateDoc(docName);
  entry.conns.set(ws, new Set());

  // Send sync step 1 (state vector request)
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, entry.doc);
  ws.send(encoding.toUint8Array(encoder));

  // Send sync step 2 (full document state)
  const encoder2 = encoding.createEncoder();
  encoding.writeVarUint(encoder2, MSG_SYNC);
  syncProtocol.writeSyncStep2(encoder2, entry.doc);
  ws.send(encoding.toUint8Array(encoder2));

  // Send current awareness states so new client knows about existing peers
  const awarenessStates = entry.awareness.getStates();
  if (awarenessStates.size > 0) {
    const ae = encoding.createEncoder();
    encoding.writeVarUint(ae, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      ae,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, Array.from(awarenessStates.keys()))
    );
    ws.send(encoding.toUint8Array(ae));
  }
}

function cleanupConnection(ws: DocWS, docName: string) {
  const entry = docs.get(docName);
  if (!entry) return;

  const controlledIds = entry.conns.get(ws);
  entry.conns.delete(ws);

  // Remove awareness states for all client IDs this connection controlled
  if (controlledIds && controlledIds.size > 0) {
    awarenessProtocol.removeAwarenessStates(
      entry.awareness,
      Array.from(controlledIds),
      null
    );
  }

  // GC: if no more connections, destroy after 30s
  if (entry.conns.size === 0) {
    setTimeout(() => {
      const cur = docs.get(docName);
      if (cur && cur.conns.size === 0) {
        cur.awareness.destroy();
        cur.doc.destroy();
        docs.delete(docName);
      }
    }, 30000);
  }
}

export { setupConnection, handleMessage, cleanupConnection };
