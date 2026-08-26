"""Profiles: reading them, editing them, and browsing them.

The identity itself is created in ``backend.auth.service``; everything here is
about the profile hanging off it.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Sequence

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import AppError, Conflict, NotFound
from ..core.validation import MAX_BIO_LENGTH, USERNAME_PATTERN, USERNAME_RULE
from ..db.models import LessonPlan, User


async def by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    return (await db.execute(select(User).where(User.id == user_id).limit(1))).scalar_one_or_none()


async def by_username(db: AsyncSession, username: str) -> Optional[User]:
    return (
        await db.execute(select(User).where(User.username == username).limit(1))
    ).scalar_one_or_none()


def _listable() -> Select:
    """Only users who claimed a username are listed.

    A username is what makes a profile addressable at /u/<name> and publishable
    at all, so an account without one is not a directory entry.
    """
    return select(User).where(User.username.is_not(None))


async def browse(db: AsyncSession, query: str = "", limit: int = 50) -> Sequence[User]:
    """Everyone with a username, optionally narrowed by a search."""
    statement = _listable()
    term = query.strip()
    if term:
        pattern = f"%{term}%"
        statement = statement.where(
            or_(
                User.username.ilike(pattern),
                User.given_name.ilike(pattern),
                User.family_name.ilike(pattern),
            )
        )
    return (await db.execute(statement.limit(limit))).scalars().all()


async def search_usernames(db: AsyncSession, query: str, limit: int = 10) -> Sequence[User]:
    """Autocomplete for the co-author picker.

    Narrower than ``browse`` on purpose: it is a picker, not a directory. The
    two-character floor keeps a single keystroke from returning the whole table.
    """
    if len(query) < 2:
        return []
    return (
        (
            await db.execute(
                _listable().where(User.username.ilike(f"%{query}%")).limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def published_by(db: AsyncSession, user_id: str) -> Sequence[LessonPlan]:
    """Someone's public documents — the substance of a public profile."""
    return (
        (
            await db.execute(
                select(LessonPlan)
                .where(LessonPlan.user_id == user_id, LessonPlan.is_public.is_(True))
                .order_by(LessonPlan.updated_at.desc())
            )
        )
        .scalars()
        .all()
    )


async def profile_for(db: AsyncSession, username: str) -> tuple[User, Sequence[LessonPlan]]:
    person = await by_username(db, username)
    if person is None:
        raise NotFound("Profile not found")
    return person, await published_by(db, person.id)


#: Distinguishes "the caller left this field out" from "the caller sent null".
_ABSENT = object()


async def update_profile(
    db: AsyncSession,
    user: User,
    *,
    username: str | None | object = _ABSENT,
    bio: str | None | object = _ABSENT,
    avatar_url: str | None | object = _ABSENT,
) -> User:
    """Apply any subset of the three editable fields.

    The username rule is enforced here, not only in the edit form. It had been
    a browser-side check alone, so a direct PATCH could set a username
    containing a slash or a space — which then produced a /u/<name> link that
    could not resolve back to its own account.
    """
    changed = False

    if username is not _ABSENT:
        if not isinstance(username, str) or not USERNAME_PATTERN.match(username):
            raise AppError(USERNAME_RULE, 400)
        taken = await by_username(db, username)
        if taken is not None and taken.id != user.id:
            raise Conflict("Username is already taken")
        user.username = username
        changed = True

    if bio is not _ABSENT:
        if bio is not None and (not isinstance(bio, str) or len(bio) > MAX_BIO_LENGTH):
            raise AppError(f"Bio must be {MAX_BIO_LENGTH} characters or fewer", 400)
        user.bio = bio
        changed = True

    if avatar_url is not _ABSENT:
        if avatar_url is not None and not isinstance(avatar_url, str):
            raise AppError("Invalid avatar URL", 400)
        user.avatar_url = avatar_url
        changed = True

    if not changed:
        raise AppError("No fields to update", 400)

    user.updated_at = datetime.utcnow()
    await db.flush()
    return user


async def username_lookup(db: AsyncSession, ids: List[str]):
    """Resolve a set of user ids to usernames, in one query.

    Returns a lookup rather than a parallel list so a caller holding several
    documents resolves every co-author across all of them at once — the list
    endpoint used to issue this query once per document.
    """
    unique = list({user_id for user_id in ids if user_id})
    if not unique:
        return lambda user_id: None

    rows = (
        (await db.execute(select(User.id, User.username).where(User.id.in_(unique))))
        .tuples()
        .all()
    )
    by_id_map = {row_id: name for row_id, name in rows if name}
    # None, not the id, for a user who has not set a username (or is gone).
    # The id used to stand in for itself so a co-author showed as *something*,
    # and while that list was only ever a tooltip it did no harm. It is a list
    # of profile links now, and a 32-character hexadecimal string is neither a
    # name a reader recognises nor a handle that resolves to a profile. The
    # caller keeps the position — the person is still on the document — and
    # decides what to call someone it has no handle for.
    return lambda user_id: by_id_map.get(user_id)
