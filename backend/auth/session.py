"""Session tokens: minting them, resolving them, and the cookie they ride in.

The cookie holds a random 32-byte token and nothing else. Its sha256 is what
the ``auth_sessions`` table stores, so the token is only ever in two places —
the user's browser, and the request that carries it.

Every cookie the application sets goes through ``_set_cookie``, so the flags
are stated once. They had been spelled out at each call site in the server this
replaces, and the sign-in path and the refresh path had drifted apart.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Response
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..db.models import AuthSession, User

SESSION_COOKIE = "session"

#: Re-issued on use, so an active session never expires under someone.
SESSION_TTL = timedelta(days=settings.session_ttl_days)

#: Below this, a session near its expiry is not worth a write on every request.
_REFRESH_THRESHOLD = SESSION_TTL / 2


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    """What the table stores. Plain sha256: the input is already 256 bits of
    entropy, so there is nothing for a slow hash to protect against here."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _set_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,  # unreadable from JavaScript, so an XSS cannot exfiltrate it
        # Only in production, so plain http://localhost still holds a session.
        secure=settings.is_production,
        # "lax" is also the CSRF defence: the browser withholds this cookie on
        # cross-site POSTs, which is every form of forged write this API has.
        samesite="lax",
        path="/",
    )


# ── Minting ──────────────────────────────────────────────────────────────
async def start_session(
    db: AsyncSession,
    response: Response,
    user: User,
    *,
    user_agent: Optional[str] = None,
) -> str:
    """Create a session for ``user`` and attach its cookie to ``response``."""
    token = secrets.token_urlsafe(32)
    expires_at = _now() + SESSION_TTL

    db.add(
        AuthSession(
            token_hash=_hash(token),
            user_id=user.id,
            expires_at=expires_at,
            last_seen_at=_now(),
            user_agent=(user_agent or "")[:512] or None,
        )
    )
    await db.flush()

    _set_cookie(response, token, int(SESSION_TTL.total_seconds()))
    return token


# ── Resolving ────────────────────────────────────────────────────────────
async def resolve_session(db: AsyncSession, token: Optional[str]) -> Optional[User]:
    """The user this token belongs to, or None.

    One statement joins the session to its user, so a session whose account was
    deleted resolves to nothing rather than to a dangling id.
    """
    if not token:
        return None

    row = (
        await db.execute(
            select(AuthSession, User)
            .join(User, User.id == AuthSession.user_id)
            .where(AuthSession.token_hash == _hash(token))
            .limit(1)
        )
    ).first()
    if row is None:
        return None

    session, user = row
    if session.expires_at <= _now():
        # Expired sessions are cleaned up as they are encountered, so the table
        # does not need a sweeper to stay small.
        await db.execute(delete(AuthSession).where(AuthSession.token_hash == session.token_hash))
        return None

    await _touch(db, session)
    return user


async def _touch(db: AsyncSession, session: AuthSession) -> None:
    """Record use, and extend the expiry once it is over halfway spent.

    Written conditionally rather than on every request: this runs on every
    authenticated call, and an unconditional UPDATE would make each of them a
    write to the same row.
    """
    now = _now()
    values: dict = {"last_seen_at": now}
    if session.expires_at - now < _REFRESH_THRESHOLD:
        values["expires_at"] = now + SESSION_TTL

    await db.execute(
        update(AuthSession).where(AuthSession.token_hash == session.token_hash).values(**values)
    )


def refresh_cookie(response: Response, token: str) -> None:
    """Re-send the cookie so the browser's own copy tracks the extended expiry."""
    _set_cookie(response, token, int(SESSION_TTL.total_seconds()))


# ── Ending ───────────────────────────────────────────────────────────────
async def end_session(db: AsyncSession, response: Response, token: Optional[str]) -> None:
    """Sign out this browser. Deleting the row is what makes it immediate."""
    if token:
        await db.execute(delete(AuthSession).where(AuthSession.token_hash == _hash(token)))
    clear_cookie(response)


async def end_all_sessions(db: AsyncSession, user_id: str) -> int:
    """Sign out every browser for this account. Used after a password change."""
    result = await db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
    return result.rowcount or 0


def clear_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
