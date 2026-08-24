"""Uploaded images: storing them, and finding them again.

The set of formats the app accepts is declared once, in ``IMAGE_TYPES``. It
used to be spelled out three times — a MIME→extension map for uploads, its
inverse for serving, and a third copy inside the filename regex — so adding a
format meant editing three places, and forgetting one meant files that uploaded
fine and then would not load.
"""

from __future__ import annotations

import re
import secrets
from pathlib import Path
from typing import Final

import aiofiles

from ..core.config import settings
from ..core.errors import AppError, NotFound

MAX_SIZE_BYTES: Final = 5 * 1024 * 1024
MAX_SIZE_LABEL: Final = "5MB"

#: The formats accepted, as MIME type → the extension stored on disk.
IMAGE_TYPES: Final[dict[str, str]] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}

#: Extension → MIME type, derived rather than written out a second time.
MIME_BY_EXTENSION: Final[dict[str, str]] = {ext: mime for mime, ext in IMAGE_TYPES.items()}

ACCEPTED_LABEL: Final = ", ".join(IMAGE_TYPES.values())

#: The only shape a stored filename can have: 32 hex characters, then one of
#: the extensions above.
#:
#: This is the path-traversal guard, so it is built from the same table the
#: upload writes with — a pattern listing formats by hand could fall behind it
#: and reject files this server had itself created.
STORED_NAME: Final = re.compile(rf"^[a-f0-9]{{32}}\.({'|'.join(IMAGE_TYPES.values())})$")


def uploads_dir() -> Path:
    """The directory uploads live in, created on first use."""
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings.uploads_dir


async def store(content: bytes, content_type: str) -> tuple[str, int]:
    """Write an uploaded image and return its stored name and size."""
    extension = IMAGE_TYPES.get((content_type or "").lower())
    if extension is None:
        raise AppError(f"Unsupported file type: {content_type}. Allowed: {ACCEPTED_LABEL}", 400)

    if len(content) > MAX_SIZE_BYTES:
        raise AppError(f"File too large. Maximum size is {MAX_SIZE_LABEL}", 400)

    # A random name, not the uploaded one: the client's filename is
    # attacker-controlled and would otherwise reach a path join.
    filename = f"{secrets.token_hex(16)}.{extension}"
    async with aiofiles.open(uploads_dir() / filename, "wb") as handle:
        await handle.write(content)

    return filename, len(content)


def resolve(filename: str) -> tuple[Path, str]:
    """The path and MIME type of a stored file, or a 400/404.

    The name is validated before it is joined to a directory, so a caller
    cannot walk out of the uploads folder with one.
    """
    if not STORED_NAME.match(filename):
        raise AppError("Invalid filename", 400)

    path = uploads_dir() / filename
    if not path.is_file():
        raise NotFound("File not found")

    return path, MIME_BY_EXTENSION[filename.rsplit(".", 1)[1]]
