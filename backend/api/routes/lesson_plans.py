"""Documents — the storage still calls them lesson plans.

One document is fetched one way: ``/{id}/shared``, which answers with the
document *and* what the caller may do with it. There used to be two more —
``/{id}`` for a document you could write and ``/public/{id}`` for one that had
been published — and a client that did not already know which it was holding
had to try them in turn and read the access rule off which one failed.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from ...schemas.lesson_plan import (
    LessonPlanInput,
    LessonPlanList,
    LessonPlanOut,
    SharedLessonPlan,
)
from ...services import lesson_plans as service
from ..deps import CurrentUser, Db, MaybeUser, RowId

router = APIRouter(tags=["lesson-plans"])


@router.get("", response_model=LessonPlanList)
async def list_mine(db: Db, user: CurrentUser) -> LessonPlanList:
    """Everything this user can edit: their own, plus what they co-author."""
    return LessonPlanList(lessonPlans=await service.list_writable(db, user.id))


@router.get("/public", response_model=LessonPlanList)
async def list_public(db: Db) -> LessonPlanList:
    plans = await service.list_public(db)
    return LessonPlanList(lessonPlans=[LessonPlanOut.model_validate(plan) for plan in plans])


@router.get("/{plan_id}/shared", response_model=SharedLessonPlan)
async def get_shared(plan_id: RowId, db: Db, user: MaybeUser) -> SharedLessonPlan:
    """One document as its share link reaches it, whoever is holding the link.

    Deliberately not behind ``CurrentUser``: a signed-out visitor following a
    link to a published document is an expected caller here, not a rejected
    one. What they may *do* with it comes back in ``access``.
    """
    plan, access = await service.get_shared(db, plan_id, user.id if user else None)
    return SharedLessonPlan(plan=plan, access=access)


@router.post("", response_model=LessonPlanOut, status_code=status.HTTP_201_CREATED)
async def create(payload: LessonPlanInput, db: Db, user: CurrentUser) -> LessonPlanOut:
    return LessonPlanOut.model_validate(await service.create(db, payload, user.id))


@router.put("/{plan_id}", response_model=LessonPlanOut)
async def replace(
    plan_id: RowId, payload: LessonPlanInput, db: Db, user: CurrentUser
) -> LessonPlanOut:
    return LessonPlanOut.model_validate(await service.replace(db, plan_id, payload, user.id))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(plan_id: RowId, db: Db, user: CurrentUser) -> Response:
    """Owner only: a co-author may edit a document but not destroy it."""
    await service.remove(db, plan_id, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
