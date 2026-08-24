"""Documents — the storage still calls them lesson plans.

Route order matters in one place: ``/public`` is declared ahead of ``/{id}`` so
the literal segment is not read as an id.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from ...schemas.lesson_plan import LessonPlanInput, LessonPlanList, LessonPlanOut
from ...services import lesson_plans as service
from ..deps import CurrentUser, Db, RowId

router = APIRouter(tags=["lesson-plans"])


@router.get("", response_model=LessonPlanList)
async def list_mine(db: Db, user: CurrentUser) -> LessonPlanList:
    """Everything this user can edit: their own, plus what they co-author."""
    return LessonPlanList(lessonPlans=await service.list_writable(db, user.id))


@router.get("/public", response_model=LessonPlanList)
async def list_public(db: Db) -> LessonPlanList:
    plans = await service.list_public(db)
    return LessonPlanList(lessonPlans=[LessonPlanOut.model_validate(plan) for plan in plans])


@router.get("/public/{plan_id}", response_model=LessonPlanOut)
async def get_public(plan_id: RowId, db: Db) -> LessonPlanOut:
    return LessonPlanOut.model_validate(await service.get_public(db, plan_id))


@router.get("/{plan_id}", response_model=LessonPlanOut)
async def get_one(plan_id: RowId, db: Db, user: CurrentUser) -> LessonPlanOut:
    return await service.get_writable(db, plan_id, user.id)


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
