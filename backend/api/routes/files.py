"""Uploaded images: in, and back out again."""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

from ...core.errors import AppError
from ...services import files as service
from ..deps import CurrentUser

router = APIRouter(tags=["files"])


@router.post("/upload")
async def upload(user: CurrentUser, file: UploadFile = File(...)) -> dict:
    """Store an image and return the URL that goes into the document."""
    if not file.filename and not file.content_type:
        raise AppError("No file provided", 400)

    filename, size = await service.store(await file.read(), file.content_type or "")
    return {"url": f"/api/files/{filename}", "filename": filename, "size": size}


@router.get("/{filename}")
async def serve(filename: str) -> FileResponse:
    """Serve a stored image.

    Deliberately unauthenticated: these URLs are embedded in documents and in
    avatars, and the name is 128 bits of randomness, so possession of the URL
    is the access check.
    """
    path, media_type = service.resolve(filename)
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            # The name is random and never reused, so the file at a given URL
            # can never change.
            "Cache-Control": "public, max-age=31536000, immutable"
        },
    )
