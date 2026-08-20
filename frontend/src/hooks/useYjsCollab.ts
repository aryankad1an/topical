/**
 * React hook for Yjs collaborative editing over WebSocket.
 * Manages a Y.Doc, raw WebSocket connection, and cursor awareness.
 *
 * Cursor positions use Y.RelativePosition so they automatically adjust
 * when text is inserted/deleted around them by other peers.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

export interface AwarenessCursor {
  clientId: number;
  user: { name: string; color: string };
  cursor?: { index: number; length: number };
}

const COLORS = [
  '#f472b6', '#fb923c', '#a78bfa', '#34d399', 'var(--latex-500)',
  '#fbbf24', '#e879f9', '#22d3ee', '#fb7185', '#a3e635',
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Convert an absolute index in Y.Text to a JSON-serializable relative position.
 * Relative positions survive insertions/deletions at other positions.
 */
function indexToRelPos(ytext: Y.Text, index: number): object | null {
  try {
    const relPos = Y.createRelativePositionFromTypeIndex(ytext, index);
    return Y.relativePositionToJSON(relPos);
  } catch {
    return null;
  }
}

/**
 * Convert a JSON-serialized relative position back to an absolute index.
 * Returns -1 if the position can't be resolved.
 */
function relPosToIndex(ydoc: Y.Doc, relPosJson: object): number {
  try {
    const relPos = Y.createRelativePositionFromJSON(relPosJson);
    const absPos = Y.createAbsolutePositionFromRelativePosition(relPos, ydoc);
    return absPos ? absPos.index : -1;
  } catch {
    return -1;
  }
}

export function useYjsCollab(
  docId: string | undefined,
  username: string,
  onRemoteContentChange: (text: string) => void
) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  const [peers, setPeers] = useState<AwarenessCursor[]>([]);
  const [connected, setConnected] = useState(false);
  const isRemoteUpdate = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanedUp = useRef(false);

  // Initialize content into Yjs doc (only on first load when Y.Text is empty)
  const initContent = useCallback((text: string) => {
    if (!ydocRef.current) return;
    const ytext = ydocRef.current.getText('content');
    if (ytext.length === 0 && text.length > 0) {
      ydocRef.current.transact(() => {
        ytext.insert(0, text);
      });
    }
  }, []);

  // Apply local edits to Yjs with minimal diff
  const applyLocalChange = useCallback((newText: string) => {
    if (!ydocRef.current || isRemoteUpdate.current) return;
    const ytext = ydocRef.current.getText('content');
    const currentYText = ytext.toString();
    if (currentYText === newText) return;

    ydocRef.current.transact(() => {
      let start = 0;
      while (start < currentYText.length && start < newText.length && currentYText[start] === newText[start]) start++;
      let endOld = currentYText.length;
      let endNew = newText.length;
      while (endOld > start && endNew > start && currentYText[endOld - 1] === newText[endNew - 1]) { endOld--; endNew--; }
      if (endOld > start) ytext.delete(start, endOld - start);
      if (endNew > start) ytext.insert(start, newText.substring(start, endNew));
    });
  }, []);

  // Update cursor position in awareness using Y.RelativePosition.
  // Relative positions automatically adjust when text is inserted/deleted
  // around them, so a peer's cursor moves correctly when others type nearby.
  const updateCursor = useCallback((index: number, length: number = 0) => {
    if (!awarenessRef.current || !ydocRef.current) return;
    if (isRemoteUpdate.current) return;

    const ytext = ydocRef.current.getText('content');
    const anchor = indexToRelPos(ytext, index);
    const head = length > 0 ? indexToRelPos(ytext, index + length) : anchor;

    if (anchor) {
      awarenessRef.current.setLocalStateField('cursor', {
        anchor,
        head,
      });
    }
  }, []);

  // Resolve peer relative cursor positions to absolute indices.
  // Called whenever awareness state or document content changes.
  const resolvePeerCursors = useCallback(() => {
    const ydoc = ydocRef.current;
    const awareness = awarenessRef.current;
    if (!ydoc || !awareness) return;

    const states = Array.from(awareness.getStates().entries());
    const peerList: AwarenessCursor[] = states
      .filter(([id]) => id !== ydoc.clientID)
      .filter(([_, state]) => state.user)
      .map(([id, state]) => {
        let cursor: { index: number; length: number } | undefined;

        if (state.cursor?.anchor) {
          const anchorIdx = relPosToIndex(ydoc, state.cursor.anchor);
          const headIdx = state.cursor.head ? relPosToIndex(ydoc, state.cursor.head) : anchorIdx;

          if (anchorIdx >= 0) {
            cursor = {
              index: anchorIdx,
              length: Math.max(0, (headIdx >= 0 ? headIdx : anchorIdx) - anchorIdx),
            };
          }
        }

        return {
          clientId: id,
          user: state.user,
          cursor,
        };
      });

    setPeers(peerList);
  }, []);

  useEffect(() => {
    if (!docId) return;
    cleanedUp.current = false;

    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    ydocRef.current = ydoc;
    awarenessRef.current = awareness;

    // Set local awareness state
    awareness.setLocalStateField('user', {
      name: username,
      color: pickColor(username),
    });

    // Listen for Y.Text changes → push to React state + re-resolve cursors
    const ytext = ydoc.getText('content');
    ytext.observe((_event, transaction) => {
      if (transaction.origin === 'ws') {
        isRemoteUpdate.current = true;
        onRemoteContentChange(ytext.toString());
        // Re-resolve all peer cursor positions against the new document state.
        // This is what makes cursors "move" when text is inserted before them.
        resolvePeerCursors();
        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      } else {
        onRemoteContentChange(ytext.toString());
        // Also re-resolve after local changes so peer cursors shift correctly
        resolvePeerCursors();
      }
    });

    // Listen for awareness changes → resolve and update peers
    awareness.on('change', () => {
      resolvePeerCursors();
    });

    // Send Y.Doc updates over WS — registered ONCE, outside connect()
    let currentWs: WebSocket | null = null;
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'ws') return;
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      currentWs.send(encoding.toUint8Array(encoder));
    };
    ydoc.on('update', updateHandler);

    // Send awareness updates over WS whenever local state changes
    const awarenessUpdateHandler = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }
    ) => {
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      currentWs.send(encoding.toUint8Array(encoder));
    };
    awareness.on('update', awarenessUpdateHandler);

    // WebSocket connection logic
    function connect() {
      if (cleanedUp.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/doc/${docId}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      currentWs = ws;

      ws.onopen = () => {
        setConnected(true);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID])
        );
        ws.send(encoding.toUint8Array(encoder));
      };

      ws.onmessage = (event: MessageEvent) => {
        const data = new Uint8Array(event.data);
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, ydoc, 'ws');
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
            break;
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        currentWs = null;
        if (!cleanedUp.current) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => { ws.close(); };
    }

    connect();

    return () => {
      cleanedUp.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      currentWs = null;

      ydoc.off('update', updateHandler);
      awareness.off('update', awarenessUpdateHandler);
      awareness.setLocalState(null);
      awareness.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      awarenessRef.current = null;
      setPeers([]);
    };
  }, [docId, username]);

  return { peers, connected, initContent, applyLocalChange, updateCursor, isRemoteUpdate };
}
