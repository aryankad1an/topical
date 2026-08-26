"""The community forum, as it travels over the wire."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .common import ORMModel, UtcDatetime


class CreatePostRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=5000)
    #: An optional document to attach to the post.
    lessonPlanId: Optional[int] = None  # noqa: N815
    lessonPlanName: Optional[str] = None  # noqa: N815


class CreateCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class VoteRequest(BaseModel):
    """1 or -1 only. Clearing a vote is casting the same one twice, not a 0."""

    vote: Literal[1, -1]


class PostOut(ORMModel):
    id: int
    userId: str = Field(validation_alias="user_id")  # noqa: N815
    authorName: str = Field(validation_alias="author_name")  # noqa: N815
    title: str
    body: str
    lessonPlanId: Optional[int] = Field(default=None, validation_alias="lesson_plan_id")  # noqa: N815
    lessonPlanName: Optional[str] = Field(default=None, validation_alias="lesson_plan_name")  # noqa: N815
    upvotes: int
    downvotes: int
    commentCount: int = Field(validation_alias="comment_count")  # noqa: N815
    createdAt: Optional[UtcDatetime] = Field(default=None, validation_alias="created_at")  # noqa: N815

    model_config = {"from_attributes": True, "populate_by_name": True}


class CommentOut(ORMModel):
    id: int
    postId: int = Field(validation_alias="post_id")  # noqa: N815
    userId: str = Field(validation_alias="user_id")  # noqa: N815
    authorName: str = Field(validation_alias="author_name")  # noqa: N815
    body: str
    createdAt: Optional[UtcDatetime] = Field(default=None, validation_alias="created_at")  # noqa: N815

    model_config = {"from_attributes": True, "populate_by_name": True}


class PostList(BaseModel):
    posts: List[PostOut]


class PostDetail(BaseModel):
    post: PostOut
    comments: List[CommentOut]
