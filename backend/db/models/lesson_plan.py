"""The ``lesson_plans`` table — what the rest of the app calls a document.

"Lesson plan" is the storage name; the table predates the editor. Two columns
are jsonb: ``topics`` holds the sections, and ``co_authors`` holds a plain
array of user ids, so co-authorship is a containment test rather than a join
table to keep in step.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base, created_at_column, updated_at_column


class LessonPlan(Base):
    __tablename__ = "lesson_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    main_topic: Mapped[str] = mapped_column(String, nullable=False)
    topics: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    co_authors: Mapped[Optional[list[str]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), default=list
    )
    is_public: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("false"), default=False)
    created_at: Mapped[Optional[datetime]] = created_at_column()
    updated_at: Mapped[Optional[datetime]] = updated_at_column()

    __table_args__ = (
        Index("lesson_plans_user_id_idx", "user_id"),
        Index("lesson_plans_main_topic_idx", "main_topic"),
    )
