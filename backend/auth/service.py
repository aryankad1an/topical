"""Registering, signing in, and changing a password.

The rules live here rather than in the route handlers, so that the HTTP layer
is left with parsing a body and choosing a status code. Each function takes a
session and returns a ``User``; none of them know what a cookie is.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import AppError, Conflict, Unauthorized
from ..db.models import User, new_user_id, normalize_email
from .passwords import hash_password, needs_rehash, password_problem, verify_password

logger = logging.getLogger(__name__)

#: One sentence for both halves of a failed sign-in. Saying "no such account"
#: for one and "wrong password" for the other turns the login form into a
#: register of who holds an account here.
_BAD_CREDENTIALS = "That email and password don't match an account"


async def find_by_email(db: AsyncSession, email: str) -> Optional[User]:
    return (
        await db.execute(select(User).where(User.email == normalize_email(email)).limit(1))
    ).scalar_one_or_none()


async def register(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    given_name: Optional[str] = None,
    family_name: Optional[str] = None,
) -> User:
    """Create an account, or explain why it cannot be created."""
    problem = password_problem(password)
    if problem:
        raise AppError(problem, 400)

    address = normalize_email(email)
    if await find_by_email(db, address):
        raise Conflict("An account with that email already exists")

    user = User(
        id=new_user_id(),
        email=address,
        password_hash=hash_password(password),
        given_name=(given_name or "").strip() or None,
        family_name=(family_name or "").strip() or None,
    )
    db.add(user)

    try:
        await db.flush()
    except IntegrityError:
        # The unique index is the real arbiter: two simultaneous registrations
        # both pass the check above, and exactly one of them lands.
        await db.rollback()
        raise Conflict("An account with that email already exists")

    return user


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User:
    """The account these credentials belong to, or a 401.

    A missing account still costs a hash verification. Returning early would
    make "no such user" measurably faster than "wrong password", which is the
    same disclosure the shared error message exists to prevent.
    """
    user = await find_by_email(db, email)
    stored = user.password_hash if user else None

    if not verify_password(stored, password) or user is None:
        _burn_time(stored)
        raise Unauthorized(_BAD_CREDENTIALS)

    # Cost parameters may have been raised since this hash was written; the one
    # moment the plaintext is in hand is the only chance to upgrade it.
    if user.password_hash and needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        await db.flush()

    return user


def _burn_time(stored: Optional[str]) -> None:
    """Spend the same work on a failure as on a success.

    Only needed when there was no hash to verify — ``verify_password`` has
    already done the work in every other case.
    """
    if stored is None:
        verify_password(_DUMMY_HASH, "not-the-password")


#: Hashed once at import, so an unknown email costs the same as a known one.
_DUMMY_HASH = hash_password("argon2-timing-equaliser")


async def change_password(
    db: AsyncSession, user: User, *, current_password: str, new_password: str
) -> None:
    """Replace a password, having proved the caller knows the old one."""
    if not verify_password(user.password_hash, current_password):
        raise Unauthorized("Your current password is not correct")

    problem = password_problem(new_password)
    if problem:
        raise AppError(problem, 400)

    user.password_hash = hash_password(new_password)
    await db.flush()
