"""The community forum."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, status

from ...schemas.post import (
    CommentOut,
    CreateCommentRequest,
    CreatePostRequest,
    PostDetail,
    PostList,
    PostOut,
    VoteRequest,
)
from ...services import posts as service
from ..deps import CurrentUser, Db, RowId

router = APIRouter(tags=["community"])


@router.get("", response_model=PostList)
async def list_posts(db: Db, sort: Literal["latest", "top"] = Query(default="latest")) -> PostList:
    """Reading the forum needs no account; everything below it does."""
    posts = await service.list_posts(db, sort)
    return PostList(posts=[PostOut.model_validate(post) for post in posts])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(payload: CreatePostRequest, db: Db, user: CurrentUser) -> dict:
    post = await service.create_post(
        db,
        user,
        title=payload.title,
        body=payload.body,
        lesson_plan_id=payload.lessonPlanId,
        lesson_plan_name=payload.lessonPlanName,
    )
    return {"post": PostOut.model_validate(post)}


@router.get("/{post_id}", response_model=PostDetail)
async def get_post(post_id: RowId, db: Db) -> PostDetail:
    post = await service.get_post(db, post_id)
    comments = await service.comments_for(db, post_id)
    return PostDetail(
        post=PostOut.model_validate(post),
        comments=[CommentOut.model_validate(comment) for comment in comments],
    )


@router.post("/{post_id}/vote")
async def vote(post_id: RowId, payload: VoteRequest, db: Db, user: CurrentUser) -> dict:
    """Voting the same way twice clears the vote; the other way switches it."""
    post = await service.cast_vote(db, post_id, user.id, payload.vote)
    return {"post": PostOut.model_validate(post)}


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    post_id: RowId, payload: CreateCommentRequest, db: Db, user: CurrentUser
) -> dict:
    comment = await service.add_comment(db, post_id, user, payload.body)
    return {"comment": CommentOut.model_validate(comment)}


@router.delete("/{post_id}")
async def delete_post(post_id: RowId, db: Db, user: CurrentUser) -> dict:
    await service.delete_post(db, post_id, user.id)
    return {"id": post_id}


@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: RowId, comment_id: RowId, db: Db, user: CurrentUser) -> dict:
    await service.delete_comment(db, post_id, comment_id, user.id)
    return {"id": comment_id}
