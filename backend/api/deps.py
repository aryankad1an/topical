"""The dependencies route modules share.

Re-exported from one place so a handler's signature reads as a list of what it
needs — a database session, a user, a validated id — without each module
reaching into three packages to assemble it.
"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import (  # noqa: F401  (re-exported)
    CurrentUserRow,
    RequireUserRow,
    client_user_agent,
)
from ..db.models import User
from ..db.session import get_session

#: A request-scoped session, committed when the handler returns.
Db = Annotated[AsyncSession, Depends(get_session)]

#: The signed-in user's row, or None for an anonymous visitor.
MaybeUser = CurrentUserRow

#: The signed-in user's row; 401 if there isn't one.
CurrentUser = RequireUserRow

UserAgent = Annotated[Optional[str], Depends(client_user_agent)]


#: A path id that must name a row.
#:
#: The bound matters: Postgres raises on a non-integer for an integer column
#: rather than matching nothing, so an unguarded ``/posts/abc`` answered 500
#: where it should answer 400. FastAPI's coercion covers the non-numeric case
#: and ``ge=1`` covers zero and negatives, which coerce cleanly and match
#: nothing.
RowId = Annotated[int, Path(ge=1, description="A positive row id")]

__all__ = [
    "CurrentUser",
    "Db",
    "MaybeUser",
    "RowId",
    "User",
    "UserAgent",
]
