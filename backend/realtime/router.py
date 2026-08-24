"""The collaboration socket: ``/ws/doc/{doc_id}``.

Deliberately thin. Everything about the protocol lives in ``yjs.py``; this is
the FastAPI endpoint that owns one connection's lifetime and hands its frames
over.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from .yjs import rooms

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/doc/{doc_id}")
async def document_socket(websocket: WebSocket, doc_id: str) -> None:
    """Join a document room for as long as the socket is open."""
    if not doc_id.strip():
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing doc id")
        return

    await websocket.accept()
    room = rooms.get_or_create(doc_id)
    await room.join(websocket, websocket.send_bytes)

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            data = message.get("bytes")
            if data is None:
                # The Yjs protocol is binary-only, so a text frame is a
                # misbehaving client rather than something to interpret.
                continue

            await room.handle(websocket, data)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("collaboration socket for %r failed", doc_id)
    finally:
        await room.leave(websocket)
        rooms.release(doc_id)
