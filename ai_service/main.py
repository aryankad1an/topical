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

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .crawl import crawl_for_topic, crawl_url, crawl_urls
from .models import (
    GenerateMdxRequest,
    OutlineFromDocumentRequest,
    SearchTopicsRequest,
    TransformRequest,
    UrlsMdxRequest,
)
from .prompts import (
    TRANSFORM_ACTIONS,
    latex_content_prompt,
    mdx_content_prompt,
    outline_from_document_prompt,
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
    """Parse a hierarchy the model returned, tolerating a ```json fence."""
    clean = re.sub(r"^```json\s*", "", text.strip(), flags=re.I)
    clean = re.sub(r"\s*```$", "", clean)
    parsed = json.loads(clean)
    for i, item in enumerate(parsed):
        item.setdefault("relevanceScore", max(60, 95 - i * 5))
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
    text = generate_content(topic_hierarchy_prompt(req.query), ai_client)
    return _hierarchy_envelope(_parse_topic_json(text))


@app.post("/ai/outline-from-document")
@endpoint
async def outline_from_document(req: OutlineFromDocumentRequest, ai_client=Depends(get_ai_credentials)):
    """Derive an outline from a draft the writer already has open."""
    text = generate_content(outline_from_document_prompt(req.document, req.format), ai_client)
    return _hierarchy_envelope(_parse_topic_json(text))


# ---------------------------------------------------------------------------
# Long-form generation — MDX
# ---------------------------------------------------------------------------
@app.post("/ai/generate-mdx-llm-only-raw", response_class=PlainTextResponse)
@endpoint
async def generate_mdx_llm_only_raw(req: GenerateMdxRequest, ai_client=Depends(get_ai_credentials)):
    topic = req.topic or req.selected_topic
    return generate_content(mdx_content_prompt(topic, req.main_topic, "", req.hierarchy or ""), ai_client).strip()


@app.post("/ai/single-topic-raw", response_class=PlainTextResponse)
@endpoint
async def single_topic_raw(req: GenerateMdxRequest, ai_client=Depends(get_ai_credentials)):
    context = await crawl_for_topic(req.selected_topic)
    prompt = mdx_content_prompt(req.selected_topic, req.main_topic, context, req.hierarchy or "")
    return generate_content(prompt, ai_client).strip()


@app.post("/ai/generate-mdx-from-urls-raw", response_class=PlainTextResponse)
@endpoint
async def generate_mdx_from_urls_raw(req: UrlsMdxRequest, ai_client=Depends(get_ai_credentials)):
    context = await crawl_urls(req.urls)
    prompt = mdx_content_prompt(req.selected_topic, req.main_topic, context, req.hierarchy or "")
    return generate_content(prompt, ai_client).strip()


# ---------------------------------------------------------------------------
# Long-form generation — LaTeX
# ---------------------------------------------------------------------------
@app.post("/ai/generate-latex-llm-only-raw", response_class=PlainTextResponse)
@endpoint
async def generate_latex_llm_only_raw(req: GenerateMdxRequest, ai_client=Depends(get_ai_credentials)):
    topic = req.topic or req.selected_topic
    return generate_content(latex_content_prompt(topic, req.main_topic, "", req.hierarchy or ""), ai_client).strip()


@app.post("/ai/generate-latex-crawl-raw", response_class=PlainTextResponse)
@endpoint
async def generate_latex_crawl_raw(req: GenerateMdxRequest, ai_client=Depends(get_ai_credentials)):
    context = await crawl_url(f"https://en.wikipedia.org/wiki/{req.selected_topic.replace(' ', '_')}")
    prompt = latex_content_prompt(req.selected_topic, req.main_topic, context, req.hierarchy or "")
    return generate_content(prompt, ai_client).strip()


@app.post("/ai/generate-latex-from-urls-raw", response_class=PlainTextResponse)
@endpoint
async def generate_latex_from_urls_raw(req: UrlsMdxRequest, ai_client=Depends(get_ai_credentials)):
    context = await crawl_urls(req.urls)
    prompt = latex_content_prompt(req.selected_topic, req.main_topic, context, req.hierarchy or "")
    return generate_content(prompt, ai_client).strip()


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
    # Edits should be faithful; a low temperature keeps a "fix grammar" from
    # quietly rewriting the author's argument.
    _, replaces = TRANSFORM_ACTIONS.get(req.action, TRANSFORM_ACTIONS["custom"])
    text = generate_content(prompt, ai_client, temperature=0.3 if replaces else 0.5)
    return strip_fences(text, req.format)
