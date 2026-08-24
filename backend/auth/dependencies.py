"""How a handler learns who is calling.

Two dependencies, and the difference between them is the whole access model:
``current_user`` answers None for an anonymous visitor, ``require_user`` answers
401. Handlers state which one they mean rather than checking a nullable user
themselves — that check had been written out at nine call sites in the server
this replaces, in three different wordings.
"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import Unauthorized
from ..db.models import User
from .session import SESSION_COOKIE, refresh_cookie, resolve_session

# Imported lazily to keep this module free of the api package, which imports it.
from ..db.session import get_session


async def current_user_row(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_session)],
    session_token: Annotated[Optional[str], Cookie(alias=SESSION_COOKIE)] = None,
) -> Optional[User]:
    """The ``users`` row behind the session cookie, or None.

    Re-sends the cookie on every authenticated request so the browser's copy
    tracks the expiry the server just extended; without it a session would keep
    working server-side while the cookie quietly aged out of the browser.
    """
    user = await resolve_session(db, session_token)
    if user is not None and session_token:
        refresh_cookie(response, session_token)
    return user


CurrentUserRow = Annotated[Optional[User], Depends(current_user_row)]


async def require_user_row(user: CurrentUserRow) -> User:
    """The signed-in user, or 401."""
    if user is None:
        raise Unauthorized()
    return user


RequireUserRow = Annotated[User, Depends(require_user_row)]


def client_user_agent(user_agent: Annotated[Optional[str], Header()] = None) -> Optional[str]:
    """The calling browser's own description, recorded on new sessions."""
    return user_agent
