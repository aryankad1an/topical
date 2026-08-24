"""The application: what it is made of, and the order it is assembled in.

One process now serves what three used to — the API, the collaboration socket,
the AI generation that had its own port and its own proxy hop, and the built
frontend. Each of those is a package with its own module; this file only wires
them together.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# `core.config` reads (and loads) the environment at import, so it comes first.
from .core.config import settings
from .api import api_router
from .core.errors import register_exception_handlers
from .core.logging import configure_logging
from .db.session import dispose_engine, is_configured, warm_pool
from .realtime import realtime_router
from .static import mount_frontend

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info(
        "starting on %s:%s (database %s)",
        settings.host,
        settings.port,
        "configured" if is_configured() else "NOT configured",
    )
    await warm_pool()
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    """Build the application.

    A factory rather than a module-level singleton, so a test can build a
    second one with different settings instead of reaching into this one.
    """
    configure_logging()

    app = FastAPI(
        title="Topical",
        description="Documents, collaboration, community, and AI writing assistance.",
        version="2.0.0",
        lifespan=lifespan,
    )

    # Same-origin in every deployment — the frontend is served from this
    # process, and in development Vite proxies to it rather than calling
    # across origins. Credentials therefore ride on same-origin requests and
    # this stays closed.
    if not settings.is_production:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    register_exception_handlers(app)

    app.include_router(api_router)
    app.include_router(realtime_router)

    @app.get("/health", include_in_schema=False)
    async def health() -> dict:
        return {"status": "ok", "database": is_configured()}

    # Last: its catch-all route would otherwise shadow everything above it.
    mount_frontend(app, settings.static_dir)

    return app


app = create_app()
