import app from "./app";
import { z } from "zod";
import { setupConnection, handleMessage, cleanupConnection, type DocWS } from "./ws";

const ServeEnv = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/, "Port must be a numeric string")
    .default("3000")
    .transform(Number),
});
const ProcessEnv = ServeEnv.parse(process.env);

// Store docName per WebSocket so we can clean up on close
const wsDocMap = new WeakMap<DocWS, string>();

const server = Bun.serve({
  port: ProcessEnv.PORT,
  hostname: "0.0.0.0",
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for /ws/doc/:docId
    if (url.pathname.startsWith("/ws/doc/")) {
      const docId = url.pathname.replace("/ws/doc/", "");
      if (!docId) {
        return new Response("Missing doc ID", { status: 400 });
      }
      const upgraded = server.upgrade(req, { data: { docId } });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // All other requests go through Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws: DocWS) {
      const docId = ws.data?.docId;
      if (!docId) { ws.close(); return; }
      wsDocMap.set(ws, docId);
      setupConnection(ws, docId);
    },
    message(ws: DocWS, data: string | Buffer) {
      // The Yjs sync protocol is binary-only; a text frame would be a
      // misbehaving client, so just drop it.
      if (typeof data === "string") return;
      const docId = wsDocMap.get(ws);
      if (!docId) return;
      handleMessage(ws, docId, data);
    },
    close(ws: DocWS) {
      const docId = wsDocMap.get(ws);
      if (!docId) return;
      cleanupConnection(ws, docId);
      wsDocMap.delete(ws);
    },
  },
});

console.log("server running", server.port);
