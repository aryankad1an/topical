"""The ``users`` table: an account, and the profile attached to it.

Authentication is in-house, so this row is the identity rather than a cache of
someone else's — ``email`` is the login handle and ``password_hash`` is what a
sign-in is checked against. ``password_hash`` is nullable so a row can exist
without a usable password: that is the state of an account imported from the
external provider this replaced, and the login path reports it as bad
credentials rather than letting it through.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base, created_at_column, updated_at_column


def new_user_id() -> str:
    """A fresh account id."""
    return uuid4().hex


def normalize_email(email: str) -> str:
    """The stored form of an address: trimmed and lower-cased.

    Addresses are compared here, not in Postgres with ``lower()``, so the
    unique index on ``email`` is the thing that actually enforces uniqueness —
    a case-insensitive comparison against a case-sensitive index would let two
    rows through under a race.
    """
    return email.strip().lower()


class User(Base):
    __tablename__ = "users"

    #: An opaque uuid4 hex string, not a serial: user ids appear in jsonb
    #: co-author arrays and in URLs, where a guessable sequence leaks how many
    #: accounts exist and lets one be enumerated.
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_user_id)
    username: Mapped[Optional[str]] = mapped_column(String, unique=True)
    given_name: Mapped[Optional[str]] = mapped_column(String)
    family_name: Mapped[Optional[str]] = mapped_column(String)
    #: Stored lower-cased (see ``normalize_email``) so that one address cannot
    #: register twice under different capitalisation.
    email: Mapped[Optional[str]] = mapped_column(String, unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String)
    bio: Mapped[Optional[str]] = mapped_column(String)
    avatar_url: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[Optional[datetime]] = created_at_column()
    updated_at: Mapped[Optional[datetime]] = updated_at_column()

    __table_args__ = (
        Index("users_id_idx", "id"),
        Index("users_email_idx", "email"),
        Index("users_username_idx", "username"),
    )
