"""Topical AI content service.

HTTP surface only: every request is parsed into a model (`models.py`), turned
into a prompt (`prompts.py`), sent through the user's own provider key
(`providers.py`), and — where the operation needs source material — grounded in
crawled text (`crawl.py`).
"""

import json
import logging
import re

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .crawl import crawl_for_topic, crawl_urls
from .models import (
    GenerateSectionRequest,
    OutlineFromDocumentRequest,
    RefineOutlineRequest,
    SearchTopicsRequest,
    TransformRequest,
)
from .prompts import (
    outline_from_document_prompt,
    refine_outline_prompt,
    section_prompt,
    strip_fences,
    topic_hierarchy_prompt,
    transform_prompt,
)
from .providers import endpoint, generate_content, get_ai_credentials

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Topical AI Content Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers shared by the routes
# ---------------------------------------------------------------------------
def _parse_topic_json(text: str) -> list:
    """Parse a hierarchy the model returned, tolerating a ```json fence.

    The shape is checked rather than assumed. A model that answers with
    ``{"topics": [...]}`` or a bare string used to reach ``item.setdefault``
    and raise AttributeError, which the endpoint wrapper could only report as
    an unexplained 500 — where the truth ("the model returned something
    malformed, try again") is a 502 it already knows how to say.
    """
    clean = re.sub(r"^```json\s*", "", text.strip(), flags=re.I)
    clean = re.sub(r"\s*```$", "", clean)
    parsed = json.loads(clean)

    # Some models wrap the list in an object however plainly they are asked not to.
    if isinstance(parsed, dict):
        for key in ("topics", "outline", "hierarchy", "data"):
            if isinstance(parsed.get(key), list):
                parsed = parsed[key]
                break

    if not isinstance(parsed, list) or not all(isinstance(item, dict) for item in parsed):
        raise json.JSONDecodeError("expected a JSON list of topic objects", clean, 0)

    for i, item in enumerate(parsed):
        item.setdefault("relevanceScore", max(60, 95 - i * 5))
    return parsed


def _parse_json_object(text: str) -> dict:
    """Parse a JSON object the model returned, tolerating a ``` fence."""
    clean = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.I)
    clean = re.sub(r"\s*```$", "", clean)
    parsed = json.loads(clean)
    if not isinstance(parsed, dict):
        raise json.JSONDecodeError("expected a JSON object", clean, 0)
    return parsed


def _hierarchy_envelope(parsed: list) -> dict:
    """The shape the frontend expects for both hierarchy endpoints."""
    return {"status": "success", "data": {"topics": "```json\n" + json.dumps(parsed, indent=2) + "\n```"}}


# ---------------------------------------------------------------------------
# Topic hierarchies
# ---------------------------------------------------------------------------
@app.post("/ai/search-topics")
@endpoint
async def search_topics(req: SearchTopicsRequest, ai_client=Depends(get_ai_credentials)):
    text = await generate_content(topic_hierarchy_prompt(req.query), ai_client)
    return _hierarchy_envelope(_parse_topic_json(text))


@app.post("/ai/outline-from-document")
@endpoint
async def outline_from_document(req: OutlineFromDocumentRequest, ai_client=Depends(get_ai_credentials)):
    """Derive an outline from a draft the writer already has open."""
    text = await generate_content(outline_from_document_prompt(req.document, req.format), ai_client)
    return _hierarchy_envelope(_parse_topic_json(text))


@app.post("/ai/refine-outline")
@endpoint
async def refine_outline(req: RefineOutlineRequest, ai_client=Depends(get_ai_credentials)):
    """Reorganise an outline and report what moved, and why.

    The rewritten outline is returned next to its reasoning rather than applied
    for the caller: the editor shows both and lets the writer decide, because a
    restructure that lands silently is one nobody can check.
    """
    indented = "\n".join(
        "  " * max(node.level - 1, 0) + "- " + node.title
        for node in req.outline
        if node.title.strip()
    )
    if not indented:
        raise HTTPException(status_code=400, detail="There is no outline to refine yet.")

    text = await generate_content(
        refine_outline_prompt(indented, req.subject or "", req.instruction or ""),
        ai_client,
    )
    parsed = _parse_json_object(text)

    outline = [
        {"title": str(row.get("title", "")).strip(), "level": int(row.get("level", 1) or 1)}
        for row in parsed.get("outline", [])
        if str(row.get("title", "")).strip()
    ]
    if not outline:
        raise HTTPException(status_code=502, detail="The model returned an empty outline. Try again.")

    changes = [
        {
            "title": str(row.get("title", "")).strip(),
            "kind": str(row.get("kind", "moved")).strip().lower(),
            "reason": str(row.get("reason", "")).strip(),
        }
        for row in parsed.get("changes", [])
        if str(row.get("title", "")).strip()
    ]
    return {"summary": str(parsed.get("summary", "")).strip(), "outline": outline, "changes": changes}


# ---------------------------------------------------------------------------
# Long-form generation
# ---------------------------------------------------------------------------
async def _grounding(req: GenerateSectionRequest) -> str:
    """The reference material a section is written from, per its source.

    "llm" leans on the model alone; "web" researches the topic; "urls" reads
    the pages the writer named.
    """
    if req.source == "web":
        return await crawl_for_topic(req.topic)
    if req.source == "urls":
        if not req.urls:
            raise HTTPException(status_code=400, detail="Add at least one URL to generate from.")
        return await crawl_urls(req.urls)
    return ""


@app.post("/ai/generate-section", response_class=PlainTextResponse)
@endpoint
async def generate_section(req: GenerateSectionRequest, ai_client=Depends(get_ai_credentials)):
    """Write one section of a document, in the format the document is in.

    This replaced six endpoints that differed only in output format and in
    where the reference material came from. Both are request fields now, so
    MDX and LaTeX cannot drift apart, and a fix to one grounding mode reaches
    every format that uses it — the LaTeX path used to crawl Wikipedia without
    the summary-API fallback the MDX path had, and silently returned less.
    """
    prompt = section_prompt(
        req.format,
        req.topic,
        req.main_topic,
        context=await _grounding(req),
        hierarchy=req.hierarchy or "",
        children=req.children,
        level=req.level,
    )
    return (await generate_content(prompt, ai_client)).strip()


# ---------------------------------------------------------------------------
# Inline editing — the selection actions in the editor
# ---------------------------------------------------------------------------
@app.post("/ai/transform", response_class=PlainTextResponse)
@endpoint
async def transform(req: TransformRequest, ai_client=Depends(get_ai_credentials)):
    """Rewrite, extend, or explain one passage of a document in place."""
    prompt = transform_prompt(
        action=req.action,
        fmt=req.format,
        selection=req.selection,
        instruction=req.instruction or "",
        before=req.before or "",
        after=req.after or "",
        title=req.title or "",
    )
    text = await generate_content(prompt, ai_client)
    return strip_fences(text, req.format)
