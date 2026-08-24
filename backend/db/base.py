"""The declarative base every model inherits, and the shared column types."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    """Declarative base for every table in the application."""


def created_at_column():
    """``created_at timestamp default now()`` — the column every table carries."""
    return mapped_column(DateTime(timezone=False), server_default=func.now(), default=datetime.utcnow)


def updated_at_column():
    """``updated_at``, refreshed by the services that write the row.

    Deliberately not ``onupdate``: the value is set explicitly where a write
    happens so that a background backfill can leave it alone.
    """
    return mapped_column(DateTime(timezone=False), server_default=func.now(), default=datetime.utcnow)
