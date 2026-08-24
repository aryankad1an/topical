"""Documents: reading, writing, sharing and deleting them.

Access is either ownership or co-authorship, and that rule is spelled out once
— in ``writable_by`` — rather than at each of the four operations that need it.
It had been copy-pasted as a raw ``jsonb @>`` fragment, and a rule duplicated
four times is a rule that only has to be fixed in three places to become a hole.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy import ColumnElement, delete, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.errors import NotFound
from ..db.models import LessonPlan, User
from ..schemas.lesson_plan import LessonPlanInput, LessonPlanOut
from .users import username_lookup

#: How many documents one listing returns.
LIST_LIMIT = 100


def writable_by(user_id: str) -> ColumnElement[bool]:
    """Documents this user may read and write.

    The ones they own, plus the ones they are named on as a co-author.
    ``co_authors`` is a jsonb array of user ids, so membership is a containment
    test rather than a join — there is no join table to keep in step.
    """
    return or_(
        LessonPlan.user_id == user_id,
        LessonPlan.co_authors.op("@>")(text("CAST(:co_author_id AS jsonb)")).params(
            co_author_id=f'["{user_id}"]'
        ),
    )


def _co_authors(plan: LessonPlan) -> list[str]:
    return list(plan.co_authors or [])


async def _decorate(
    db: AsyncSession, rows: Sequence[tuple[LessonPlan, Optional[str]]]
) -> list[LessonPlanOut]:
    """Attach author and co-author usernames to a page of documents.

    One lookup for the whole page rather than one per document.
    """
    resolve = await username_lookup(db, [uid for plan, _ in rows for uid in _co_authors(plan)])
    out = []
    for plan, author_username in rows:
        model = LessonPlanOut.model_validate(plan)
        model.authorUsername = author_username
        model.coAuthorUsernames = [resolve(uid) for uid in _co_authors(plan)]
        out.append(model)
    return out


async def list_writable(db: AsyncSession, user_id: str) -> list[LessonPlanOut]:
    """Everything this user can edit."""
    rows = (
        (
            await db.execute(
                select(LessonPlan, User.username)
                .outerjoin(User, LessonPlan.user_id == User.id)
                .where(writable_by(user_id))
                .order_by(LessonPlan.created_at.desc())
                .limit(LIST_LIMIT)
            )
        )
        .tuples()
        .all()
    )
    return await _decorate(db, rows)


async def get_writable(db: AsyncSession, plan_id: int, user_id: str) -> LessonPlanOut:
    """One document this user may edit, or 404."""
    row = (
        (
            await db.execute(
                select(LessonPlan, User.username)
                .outerjoin(User, LessonPlan.user_id == User.id)
                .where(LessonPlan.id == plan_id, writable_by(user_id))
                .limit(1)
            )
        )
        .tuples()
        .first()
    )
    if row is None:
        raise NotFound("Lesson plan not found")
    return (await _decorate(db, [row]))[0]


async def list_public(db: AsyncSession) -> Sequence[LessonPlan]:
    return (
        (
            await db.execute(
                select(LessonPlan)
                .where(LessonPlan.is_public.is_(True))
                .order_by(LessonPlan.created_at.desc())
                .limit(LIST_LIMIT)
            )
        )
        .scalars()
        .all()
    )


async def get_public(db: AsyncSession, plan_id: int) -> LessonPlan:
    """One published document.

    A private document and a missing one answer alike: whether an id exists is
    not something an unauthenticated caller should be able to probe.
    """
    plan = (
        await db.execute(
            select(LessonPlan)
            .where(LessonPlan.id == plan_id, LessonPlan.is_public.is_(True))
            .limit(1)
        )
    ).scalar_one_or_none()
    if plan is None:
        raise NotFound("Public lesson plan not found")
    return plan


def _values(payload: LessonPlanInput) -> dict[str, Any]:
    return {
        "name": payload.name,
        "main_topic": payload.mainTopic,
        "topics": [topic.model_dump() for topic in payload.topics],
        "co_authors": payload.coAuthors,
        "is_public": payload.isPublic,
    }


async def create(db: AsyncSession, payload: LessonPlanInput, user_id: str) -> LessonPlan:
    """The owner comes from the session, never from the body."""
    plan = LessonPlan(user_id=user_id, **_values(payload))
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


async def replace(
    db: AsyncSession, plan_id: int, payload: LessonPlanInput, user_id: str
) -> LessonPlan:
    """Overwrite a document the caller may write, or 404.

    The access check is the same statement as the write. It used to run as its
    own SELECT with an identical WHERE clause, which is both a wasted round
    trip and a window in which access could change between the two.
    """
    plan = (
        await db.execute(
            select(LessonPlan).where(LessonPlan.id == plan_id, writable_by(user_id)).limit(1)
        )
    ).scalar_one_or_none()
    if plan is None:
        raise NotFound("Lesson plan not found")

    for column, value in _values(payload).items():
        setattr(plan, column, value)
    plan.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(plan)
    return plan


async def remove(db: AsyncSession, plan_id: int, user_id: str) -> None:
    """Delete a document. Owner only — a co-author may edit but not destroy."""
    result = await db.execute(
        delete(LessonPlan).where(LessonPlan.id == plan_id, LessonPlan.user_id == user_id)
    )
    if not result.rowcount:
        raise NotFound("Lesson plan not found")
