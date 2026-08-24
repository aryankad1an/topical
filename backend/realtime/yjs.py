"""Collaborative editing: one shared CRDT document per room.

The wire protocol is y-protocols, the same one ``y-websocket`` speaks, so the
browser side is unchanged: a binary frame whose first varint is 0 carries a
sync message and 1 carries an awareness update.

The server is a full participant rather than a relay. It keeps the merged
document, which is what lets somebody opening a document that is already being
edited receive its current state instead of an empty page — a relay has nothing
to answer sync step 1 with.

Documents live in memory only. Nothing here is the durable copy: the editor
saves through the REST API, and a room is discarded once it has been empty for
``EMPTY_ROOM_TTL``.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Iterable, Optional

from pycrdt import (
    Awareness,
    Decoder,
    Doc,
    YMessageType,
    YSyncMessageType,
    create_awareness_message,
    create_sync_message,
    create_update_message,
    handle_sync_message,
    read_message,
    write_message,
)

logger = logging.getLogger(__name__)

#: How long an empty room is kept before its document is dropped, so a reload
#: or a brief disconnection does not lose the in-memory state.
EMPTY_ROOM_TTL = 30.0


class Connection:
    """One websocket in a room, and the awareness clients it speaks for."""

    def __init__(self, send) -> None:
        self._send = send
        #: Awareness client ids seen from this socket, so its cursors can be
        #: withdrawn when it goes away.
        self.client_ids: set[int] = set()

    async def send(self, message: bytes) -> None:
        try:
            await self._send(message)
        except Exception:
            # A socket that closed mid-broadcast is normal; the close handler
            # removes it. Failing the whole broadcast over it is not.
            logger.debug("dropping message to a closed connection", exc_info=True)


class Room:
    """A document, its awareness, and everyone currently in it."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.doc = Doc()
        self.awareness = Awareness(self.doc)
        # Awareness() gives itself a local state on construction. The server is
        # not a participant with a cursor, and leaving it set makes every
        # client render a phantom collaborator that never moves.
        self.awareness.set_local_state(None)

        self.connections: dict[object, Connection] = {}
        self._reap_task: Optional[asyncio.Task] = None

        # Set for the duration of one inbound message, so the broadcast that an
        # update triggers can skip the sender. Safe despite being shared state:
        # it is assigned and cleared around a synchronous call with no await
        # between, so no other task can observe it set.
        self._origin: Optional[object] = None

        self.doc.observe(self._on_doc_update)
        self.awareness.observe(self._on_awareness_update)

    # ── Broadcasting ─────────────────────────────────────────────────────
    def _on_doc_update(self, event) -> None:
        """Forward a merged document update to everyone but its sender."""
        self._broadcast(create_update_message(event.update), exclude=self._origin)

    def _on_awareness_update(self, topic: str, change) -> None:
        """Forward cursor and presence changes to everyone but their sender."""
        if topic != "update":
            return
        changes, origin = change
        client_ids = [
            *changes.get("added", []),
            *changes.get("updated", []),
            *changes.get("removed", []),
        ]
        if not client_ids:
            return
        update = self.awareness.encode_awareness_update(client_ids)
        self._broadcast(create_awareness_message(update), exclude=origin)

    def _broadcast(self, message: bytes, *, exclude: object = None) -> None:
        """Queue a message to every connection except ``exclude``.

        Fire-and-forget tasks, because this is called from synchronous CRDT
        callbacks that cannot await. The alternative — buffering and sending
        after the handler returns — would reorder updates against the sync
        replies sent inline.
        """
        for key, connection in list(self.connections.items()):
            if key is exclude:
                continue
            asyncio.create_task(connection.send(message))

    # ── Membership ───────────────────────────────────────────────────────
    async def join(self, key: object, send) -> Connection:
        """Add a connection and bring it up to date."""
        if self._reap_task is not None:
            self._reap_task.cancel()
            self._reap_task = None

        connection = Connection(send)
        self.connections[key] = connection

        # Both sync steps, unprompted. Step 1 asks what the client has; step 2
        # hands over everything the server has, which is what makes a document
        # already in progress render for the person who just opened it.
        #
        # The browser client opens by sending awareness only and waits for the
        # server to start the sync handshake, so sending step 1 alone — what
        # y-websocket's own server does — would leave it holding an empty
        # document until its first local edit.
        await connection.send(create_sync_message(self.doc))
        await connection.send(_sync_step2(self.doc.get_update()))

        # Existing peers' cursors, so a new arrival sees who else is here.
        states = self.awareness.states
        if states:
            update = self.awareness.encode_awareness_update(list(states.keys()))
            await connection.send(create_awareness_message(update))

        return connection

    async def leave(self, key: object) -> None:
        """Remove a connection and withdraw the cursors it spoke for."""
        connection = self.connections.pop(key, None)
        if connection is None:
            return

        if connection.client_ids:
            # Without this the departed writer's cursor stays on everyone
            # else's screen until the awareness timeout expires it.
            self.awareness.remove_awareness_states(list(connection.client_ids), None)

    # ── Inbound ──────────────────────────────────────────────────────────
    async def handle(self, key: object, message: bytes) -> None:
        """Apply one frame from a client."""
        connection = self.connections.get(key)
        if connection is None or not message:
            return

        message_type = message[0]

        if message_type == YMessageType.SYNC:
            # `_origin` is read by `_on_doc_update`, which `handle_sync_message`
            # triggers synchronously. No await separates the two.
            self._origin = key
            try:
                # The message minus its YMessageType byte; the sync sub-type is
                # what handle_sync_message reads first.
                reply = handle_sync_message(message[1:], self.doc)
            finally:
                self._origin = None
            if reply:
                # Already a complete frame, YMessageType byte included — adding
                # another one made the client read the type as the sub-type and
                # fail with "Cannot decode state".
                await connection.send(reply)

        elif message_type == YMessageType.AWARENESS:
            update = read_message(message[1:])
            connection.client_ids.update(_client_ids_in(update))
            self.awareness.apply_awareness_update(update, key)

    # ── Lifetime ─────────────────────────────────────────────────────────
    @property
    def is_empty(self) -> bool:
        return not self.connections

    def schedule_reap(self, on_reap) -> None:
        """Drop this room once it has been empty for ``EMPTY_ROOM_TTL``."""

        async def _reap() -> None:
            try:
                await asyncio.sleep(EMPTY_ROOM_TTL)
            except asyncio.CancelledError:
                return
            if self.is_empty:
                on_reap(self.name)

        self._reap_task = asyncio.create_task(_reap())


def _sync_step2(update: bytes) -> bytes:
    """A SYNC_STEP2 frame carrying a full document state."""
    return bytes([YMessageType.SYNC, YSyncMessageType.SYNC_STEP2]) + write_message(update)


def _client_ids_in(update: bytes) -> Iterable[int]:
    """The awareness client ids an update speaks for.

    Read so that a disconnecting socket's cursors can be withdrawn by id. A
    malformed frame yields nothing rather than raising: the cost of missing one
    is a stale cursor, and the cost of raising is the whole connection.
    """
    try:
        decoder = Decoder(update)
        count = decoder.read_var_uint()
        ids = []
        for _ in range(count):
            ids.append(decoder.read_var_uint())
            decoder.read_var_uint()  # clock
            decoder.read_var_string()  # state json
        return ids
    except Exception:
        logger.debug("unparseable awareness update", exc_info=True)
        return ()


class RoomRegistry:
    """Every live room, by document id."""

    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def get_or_create(self, name: str) -> Room:
        room = self._rooms.get(name)
        if room is None:
            room = Room(name)
            self._rooms[name] = room
            logger.info("opened collaboration room %r", name)
        return room

    def discard(self, name: str) -> None:
        room = self._rooms.pop(name, None)
        if room is not None:
            logger.info("closed collaboration room %r", name)

    def release(self, name: str) -> None:
        """Called when a connection leaves; reaps the room if it emptied."""
        room = self._rooms.get(name)
        if room is not None and room.is_empty:
            room.schedule_reap(self.discard)

    def __len__(self) -> int:
        return len(self._rooms)


#: One registry per process.
rooms = RoomRegistry()
