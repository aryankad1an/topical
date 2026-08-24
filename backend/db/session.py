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
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # a connection killed by the provider's idle timeout is replaced, not raised
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


async def dispose_engine() -> None:
    """Close the pool on shutdown."""
    if engine is not None:
        await engine.dispose()
