"""The ``auth_sessions`` table — one row per signed-in browser.

Sessions are server-side and opaque: the cookie carries a random token that
means nothing on its own, and the row here is what gives it meaning. That is
the property a self-contained token (a JWT) cannot offer — signing out, or
revoking a stolen session, is a DELETE, and it takes effect on the next
request rather than whenever the token happens to expire.

Only the *hash* of the token is stored. A leaked database therefore yields no
usable sessions, exactly as it yields no usable passwords.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    #: The sha256 of the cookie token, hex-encoded. Primary key because it is
    #: what every lookup is by, and it is unique by construction.
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Rolled forward as the session is used, so an active session does not
    #: expire out from under someone mid-document.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    #: Only so a future "your sessions" screen can say which browser this is.
    user_agent: Mapped[Optional[str]] = mapped_column(String)

    __table_args__ = (
        Index("auth_sessions_user_id_idx", "user_id"),
        Index("auth_sessions_expires_at_idx", "expires_at"),
    )
