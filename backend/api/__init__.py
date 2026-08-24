"""The HTTP surface: every route, gathered under /api.

Assembled here rather than in the app factory so that mounting the API
somewhere else — a test client, a second prefix — is one import.
"""

from fastapi import APIRouter

from .routes import ai, auth, files, lesson_plans, posts, users

api_router = APIRouter(prefix="/api")

api_router.include_router(ai.router, prefix="/ai")
api_router.include_router(lesson_plans.router, prefix="/lessonPlans")
api_router.include_router(files.router, prefix="/files")
api_router.include_router(posts.router, prefix="/posts")
# Last, and prefix-less: these own the bare paths (/api/me, /api/people/...),
# so anything with a prefix of its own has to be matched before them.
api_router.include_router(auth.router)
api_router.include_router(users.router)

__all__ = ["api_router"]
