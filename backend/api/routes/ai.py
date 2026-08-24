"""AI content generation.

These used to live in a second process, reached over a proxy hop that existed
only to apply authentication. The authentication is a dependency now and the
service is an import, so the hop, its 90-second timeout, its 502 translation
and its separate port are all gone.

The user's provider credentials arrive as three headers and are used for the
one call they were sent for. They are never stored, never logged, and never
written to the database.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.responses import PlainTextResponse

from ...schemas.ai import (
    GenerateSectionRequest,
    OutlineFromDocumentRequest,
    RefineOutlineRequest,
    SearchTopicsRequest,
    TransformRequest,
)
from ...services.ai import AiCredentials, build_credentials
from ...services.ai import generation
from ..deps import CurrentUser

router = APIRouter(tags=["ai"])


def ai_credentials(
    x_ai_provider: Annotated[str, Header()] = "",
    x_ai_model: Annotated[str, Header()] = "",
    x_ai_api_key: Annotated[str, Header()] = "",
) -> AiCredentials:
    """The provider, model and key for this one request."""
    return build_credentials(x_ai_provider, x_ai_model, x_ai_api_key)


Credentials = Annotated[AiCredentials, Depends(ai_credentials)]


@router.post("/search-topics")
async def search_topics(req: SearchTopicsRequest, user: CurrentUser, creds: Credentials) -> dict:
    """A topic hierarchy for a subject the writer names."""
    return await generation.search_topics(req, credentials=creds)


@router.post("/outline-from-document")
async def outline_from_document(
    req: OutlineFromDocumentRequest, user: CurrentUser, creds: Credentials
) -> dict:
    """An outline derived from a draft the writer already has open."""
    return await generation.outline_from_document(req, credentials=creds)


@router.post("/refine-outline")
async def refine_outline(
    req: RefineOutlineRequest, user: CurrentUser, creds: Credentials
) -> dict:
    """A better-organised outline, next to the reasoning for each move."""
    return await generation.refine_outline(req, credentials=creds)


@router.post("/generate-section", response_class=PlainTextResponse)
async def generate_section(
    req: GenerateSectionRequest, user: CurrentUser, creds: Credentials
) -> str:
    """One section of a document, in the format the document is in."""
    return await generation.generate_section(req, credentials=creds)


@router.post("/transform", response_class=PlainTextResponse)
async def transform(req: TransformRequest, user: CurrentUser, creds: Credentials) -> str:
    """Rewrite, extend, or explain one passage in place."""
    return await generation.transform(req, credentials=creds)
