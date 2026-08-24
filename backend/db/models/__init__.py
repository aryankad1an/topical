"""Every table, imported here so Alembic's autogenerate sees all of them."""

from .lesson_plan import LessonPlan
from .post import Post, PostComment, PostVote
from .session import AuthSession
from .user import User, new_user_id, normalize_email

__all__ = [
    "AuthSession",
    "LessonPlan",
    "Post",
    "PostComment",
    "PostVote",
    "User",
    "new_user_id",
    "normalize_email",
]
