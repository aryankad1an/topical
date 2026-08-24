"""The community forum: posts, their comments, and the standing votes on them.

Nothing here is linked at the schema level — a comment carries a ``post_id``
with no foreign key behind it — so the service layer checks the post exists
before writing either, and deleting a post takes its votes and comments with
it. An orphaned row is invisible and permanent.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base, created_at_column


class Post(Base):
    __tablename__ = "community_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    author_name: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'Anonymous'"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''"), default="")
    #: An optional document attached to the post.
    lesson_plan_id: Mapped[Optional[int]] = mapped_column(Integer)
    lesson_plan_name: Mapped[Optional[str]] = mapped_column(String)
    upvotes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    downvotes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"), default=0)
    created_at: Mapped[Optional[datetime]] = created_at_column()


class PostComment(Base):
    __tablename__ = "community_post_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    author_name: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'Anonymous'"))
    body: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = created_at_column()


class PostVote(Base):
    __tablename__ = "community_post_votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    #: 1 for an upvote, -1 for a downvote. A cleared vote deletes the row.
    vote: Mapped[int] = mapped_column(Integer, nullable=False)
