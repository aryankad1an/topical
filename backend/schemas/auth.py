"""Request and response bodies for registering, signing in, and the session."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from ..auth.passwords import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH


class RegisterRequest(BaseModel):
    """A new account.

    The length bound is declared here as well as in ``password_problem`` so an
    oversized password is rejected before it reaches argon2 — the check exists
    precisely to cap how much work one unauthenticated request can ask for.
    """

    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    given_name: Optional[str] = Field(default=None, max_length=100)
    family_name: Optional[str] = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    """Deliberately not ``EmailStr``: an address that fails to parse is a failed
    sign-in, not a 400 that tells the caller their guess was malformed."""

    email: str
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=MAX_PASSWORD_LENGTH)
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class SessionUser(BaseModel):
    """The signed-in user, in the shape the browser client already reads.

    The snake_case names are the ones the frontend's ``User`` interface uses;
    ``avatarUrl`` is camelCase there and so it is aliased rather than renamed,
    because renaming it would be a change to every profile screen.
    """

    id: str
    email: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None  # noqa: N815 - matches the existing client


class SessionResponse(BaseModel):
    """What ``/api/me`` and both sign-in routes answer with."""

    user: Optional[SessionUser] = None
    #: True on the response immediately after registration, so the client can
    #: run onboarding once.
    isNewUser: bool = False  # noqa: N815 - matches the existing client
