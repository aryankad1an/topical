"""Registering, signing in, signing out, and reading the current session.

Sign-in is an XHR against this API rather than a redirect to somebody else's
domain, so these handlers answer with the session user and the browser stays
where it is. The session itself is a cookie the handler attaches; see
``backend.auth.session``.
"""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Response, status
from typing import Annotated, Optional

from ...auth import service as auth_service
from ...auth.session import (
    SESSION_COOKIE,
    end_all_sessions,
    end_session,
    start_session,
)
from ...db.models import User
from ...schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    SessionResponse,
    SessionUser,
)
from ..deps import CurrentUser, Db, MaybeUser, UserAgent

router = APIRouter(tags=["auth"])


def _session_user(user: User) -> SessionUser:
    """The row, minus the password hash. Built explicitly rather than dumped,
    so a column added to the table cannot leak by default."""
    return SessionUser(
        id=user.id,
        email=user.email,
        given_name=user.given_name,
        family_name=user.family_name,
        picture=user.avatar_url,
        username=user.username,
        bio=user.bio,
        avatarUrl=user.avatar_url,
    )


@router.post("/auth/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: Db,
    user_agent: UserAgent,
) -> SessionResponse:
    """Create an account and sign it in, in one round trip.

    Registering and then having to sign in is two forms for one intention, and
    the second one is where people gave up.
    """
    user = await auth_service.register(
        db,
        email=str(payload.email),
        password=payload.password,
        given_name=payload.given_name,
        family_name=payload.family_name,
    )
    await start_session(db, response, user, user_agent=user_agent)
    # The client runs onboarding once, on exactly this response.
    return SessionResponse(user=_session_user(user), isNewUser=True)


@router.post("/auth/login", response_model=SessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: Db,
    user_agent: UserAgent,
) -> SessionResponse:
    user = await auth_service.authenticate(db, email=payload.email, password=payload.password)
    await start_session(db, response, user, user_agent=user_agent)
    return SessionResponse(user=_session_user(user))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: Db,
    session_token: Annotated[Optional[str], Cookie(alias=SESSION_COOKIE)] = None,
) -> Response:
    """End this browser's session.

    No guard and no 401: signing out when already signed out is the state the
    caller asked for, and answering it with an error would be absurd.
    """
    await end_session(db, response, session_token)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/auth/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    db: Db,
    user: CurrentUser,
    user_agent: UserAgent,
) -> Response:
    """Change a password, then sign every other browser out.

    A password change is what someone does when they think a session has been
    stolen, so leaving the other sessions alive would defeat the point. This
    browser is signed straight back in so the person doing it is not logged out
    of the screen they are standing on.
    """
    await auth_service.change_password(
        db, user, current_password=payload.current_password, new_password=payload.new_password
    )
    await end_all_sessions(db, user.id)
    await start_session(db, response, user, user_agent=user_agent)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=SessionResponse)
async def me(user: MaybeUser) -> SessionResponse:
    """The signed-in user, or a null session.

    Answers 200 with ``{"user": null}`` rather than 401 for an anonymous
    visitor: that is the expected state on a first visit, and the client treats
    it as "no session" without a failed request in the console.
    """
    return SessionResponse(user=_session_user(user) if user else None)
