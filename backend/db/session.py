"""The engine and session factory, or None when DATABASE_URL is unset.

None rather than a throw, so the server still boots for anyone who only wants
the frontend or the AI routes. Asking for a session without one configured is
then a 503 naming the variable to set, raised here — one guard covering every
route, rather than a marker dependency each of them has to remember to list.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..core.config import settings
from ..core.errors import ServiceUnavailable

logger = logging.getLogger(__name__)

engine: Optional[AsyncEngine] = None
session_factory: Optional[async_sessionmaker[AsyncSession]] = None

if settings.async_database_url:
    engine = create_async_engine(
        settings.async_database_url,
        # Opening a connection to a managed Postgres costs a TLS handshake plus
        # the Postgres startup exchange — measured at ~1.6s against the hosted
        # database this runs on. So the pool is sized to hold every connection a
        # normal load needs, and `max_overflow` is small: an overflow connection
        # is a 1.6s stall inside one request.
        pool_size=10,
        max_overflow=5,
        # `pool_pre_ping` was here to survive the provider closing an idle
        # connection. It does that by issuing a SELECT 1 before *every* checkout
        # — one extra network round trip on every single request, which is 105ms
        # against a database in another region. Recycling connections before the
        # provider's idle timeout reaches them costs nothing and covers the same
        # case; the pool retires the connection instead of probing it.
        pool_recycle=240,
        echo=False,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def is_configured() -> bool:
    return session_factory is not None


async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per request, committed on success and rolled back on failure.

    The commit lives here rather than in each service so a handler that writes
    two rows either writes both or neither — the old backend issued each
    statement on its own and could leave a comment counted but not stored.
    """
    if session_factory is None:
        raise ServiceUnavailable("Database is not configured. Set DATABASE_URL in .env")

    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def warm_pool(connections: int = 3) -> None:
    """Open a few connections before the first request needs one.

    Connecting to the hosted database costs a TLS handshake plus the Postgres
    startup exchange — ~1.6s. A pool that starts empty pays that *inside* the
    first requests to arrive, which is why the first click after a restart felt
    broken while later ones were fine. Opening them here moves that cost to
    boot, where nobody is waiting on it.

    Failures are logged and swallowed: an unreachable database at boot should
    not stop the server from starting and serving the frontend, and the normal
    connection path will report it properly on the first request that needs it.
    """
    if engine is None:
        return
    try:
        conns = [await engine.connect() for _ in range(connections)]
        for conn in conns:
            await conn.close()  # returns it to the pool, rather than closing the socket
        logger.info("warmed %d database connections", connections)
    except Exception as exc:  # noqa: BLE001 — boot must not depend on this
        logger.warning("could not warm the connection pool: %s", exc)


async def dispose_engine() -> None:
    """Close the pool on shutdown."""
    if engine is not None:
        await engine.dispose()
