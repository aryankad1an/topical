"""Alembic's entry point, wired to the application's own settings and models.

The URL comes from ``backend.core.config`` rather than from alembic.ini, so
migrations cannot be run against a different database than the app talks to.
``target_metadata`` is the real model registry, so ``--autogenerate`` sees
every table.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from backend.core.config import settings
from backend.db.base import Base
from backend.db import models  # noqa: F401  — registers every table on Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

if not settings.async_database_url:
    raise SystemExit("DATABASE_URL is not set; nothing to migrate.")

config.set_main_option("sqlalchemy.url", settings.async_database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (``alembic upgrade --sql``)."""
    context.configure(
        url=settings.async_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with engine.connect() as connection:
        await connection.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
