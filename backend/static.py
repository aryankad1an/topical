"""Serving the built frontend, in production.

Two rules, in this order: a request that names a file in ``frontend/dist`` gets
that file, and everything else gets ``index.html`` so a client-side route
survives a hard refresh. Mounted only when the build exists — in development
Vite serves the app and proxies /api here, so a missing dist directory is the
normal state rather than a misconfiguration.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .core.errors import error_response

logger = logging.getLogger(__name__)


def mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.is_file():
        logger.info(
            "No frontend build at %s; serving the API only. Run `npm run build` in frontend/ "
            "to serve the app from this process.",
            dist,
        )
        return

    # Hashed asset filenames, so they can be cached hard.
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(request: Request, path: str):
        # An unmatched /api path is a missing endpoint, not a client-side
        # route. Falling through to index.html would answer it with 200 and a
        # page of HTML, which is how a typo'd fetch turned into "Unexpected
        # token '<'" instead of a 404.
        if path.startswith("api/") or path == "api":
            return error_response("Not found", 404)

        candidate = (dist / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(dist.resolve()):
            return FileResponse(candidate)

        return FileResponse(index)

    logger.info("serving the frontend build from %s", dist)
