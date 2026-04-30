import os
import json
import re
import logging
import asyncio
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from google import genai

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
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


def get_genai_client(request: Request):
    """Get a genai client from the per-request X-Gemini-API-Key header."""
    header_key = request.headers.get("x-gemini-api-key", "").strip()
    if not header_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Add your Gemini API key in Profile → AI Settings."
        )
    return genai.Client(api_key=header_key)


def generate_content(prompt: str, ai_client=None) -> str:
    """Generate content using the Gemini API via the google.genai SDK."""
    if not ai_client:
        raise ValueError("No API key configured. Add your Gemini API key in Profile → AI Settings.")
    response = ai_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return response.text


# ---------------------------------------------------------------------------
# Crawl4AI web crawling
# ---------------------------------------------------------------------------
async def crawl_url(url: str) -> str:
    """Use crawl4ai to extract clean text content from a URL."""
    try:
        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            if result and result.markdown:
                return result.markdown[:15000]
            return ""
    except (ImportError, TypeError):
        logger.warning("crawl4ai not available, falling back to basic fetch")
        return await _basic_fetch(url)
    except Exception as e:
        logger.warning(f"crawl4ai error for {url}: {e}, falling back to basic fetch")
        return await _basic_fetch(url)


async def _basic_fetch(url: str) -> str:
    """Robust fallback URL fetcher using urllib."""
    import urllib.request
    import ssl
    try:
        # Create a permissive SSL context for sites with cert issues
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # Clean HTML to plain text
        text = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)
        text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
        text = re.sub(r"<nav[\s\S]*?</nav>", "", text, flags=re.I)
        text = re.sub(r"<footer[\s\S]*?</footer>", "", text, flags=re.I)
        text = re.sub(r"<header[\s\S]*?</header>", "", text, flags=re.I)
        text = re.sub(r"<!--[\s\S]*?-->", "", text)
        # Convert common HTML elements to markdown
        text = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"\n## \1\n", text, flags=re.I)
        text = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", text, flags=re.I)
        text = re.sub(r"<p[^>]*>(.*?)</p>", r"\1\n\n", text, flags=re.I | re.S)
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        text = re.sub(r"&lt;", "<", text)
        text = re.sub(r"&gt;", ">", text)
        text = re.sub(r"\s{3,}", "\n\n", text).strip()
        return text[:15000]
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return f"[Failed to fetch content from {url}]"


async def crawl_for_topic(topic: str) -> str:
    """Crawl multiple sources for a topic — Wikipedia + DuckDuckGo summary."""
    wiki_url = f"https://en.wikipedia.org/wiki/{topic.replace(' ', '_')}"
    content = await crawl_url(wiki_url)
    if content and "[Failed to fetch" not in content and len(content) > 200:
        return content
    # Fallback: try a simpler Wikipedia API
    try:
        import urllib.request, json as _json
        api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{topic.replace(' ', '_')}"
        req = urllib.request.Request(api_url, headers={"User-Agent": "Topical/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
        if data.get("extract"):
            return f"# {data.get('title', topic)}\n\n{data['extract']}"
    except Exception:
        pass
    return content or ""


async def crawl_urls(urls: List[str]) -> str:
    """Crawl multiple URLs and join their content."""
    results = await asyncio.gather(*(crawl_url(u) for u in urls), return_exceptions=True)
    valid = [r for r in results if isinstance(r, str) and r and "[Failed to fetch" not in r]
    return "\n\n---\n\n".join(valid)[:20000]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class SearchTopicsRequest(BaseModel):
    query: str
    limit: Optional[int] = None


class GenerateMdxRequest(BaseModel):
    selected_topic: str
    main_topic: str
    topic: Optional[str] = None
    num_results: Optional[int] = None
    hierarchy: Optional[str] = None


class UrlMdxRequest(BaseModel):
    url: str
    selected_topic: str
    main_topic: str
    topic: Optional[str] = None
    use_llm_knowledge: Optional[bool] = None
    hierarchy: Optional[str] = None


class UrlsMdxRequest(BaseModel):
    urls: List[str]
    selected_topic: str
    main_topic: str
    topic: Optional[str] = None
    use_llm_knowledge: Optional[bool] = None
    hierarchy: Optional[str] = None


class RefineRequest(BaseModel):
    mdx: str
    question: str


class RefineWithSelectionRequest(BaseModel):
    mdx: str
    question: str
    selected_text: str
    topic: str
    direct_replacement: Optional[str] = None


class RefineWithCrawlingRequest(BaseModel):
    mdx: str
    question: str
    selected_text: str
    topic: str
    num_results: Optional[int] = None


class RefineWithUrlsRequest(BaseModel):
    mdx: str
    question: str
    selected_text: str
    topic: str
    urls: List[str]


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------
async def optimize_prompt(raw_topic: str, ai_client=None) -> str:
    """Refine a vague topic into a precise learning objective."""
    if not ai_client:
        raise HTTPException(status_code=500, detail="Error connecting to Gemini API, maybe check your api key")
    try:
        text = generate_content(
            f'Convert this topic into a precise educational learning objective in 5-10 words. '
            f'Return ONLY the optimized topic name. Topic: "{raw_topic}"',
            ai_client=ai_client
        )
        text = text.strip().strip("'\"")
        return text or raw_topic
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to Gemini API, maybe check your api key")


async def generate_mdx_content(topic: str, main_topic: str, context: str = "", hierarchy: str = "", ai_client=None) -> str:
    ctx = f"\nUse this reference material:\n<context>\n{context}\n</context>\n" if context else ""
    hier_ctx = f"\nHere is the full topic hierarchy for context:\n<hierarchy>\n{hierarchy}\n</hierarchy>\nStrictly focus ONLY on the topic '{topic}' and do not explain other topics from the hierarchy to avoid redundant content." if hierarchy else ""
    prompt = (
        f"You are an expert technical writer creating educational MDX content.\n\n"
        f"Generate comprehensive MDX content for: \"{topic}\"\n"
        f"Part of a lesson plan about: \"{main_topic}\"\n"
        f"{hier_ctx}\n"
        f"{ctx}\n"
        f"Requirements:\n"
        f"- MDX format (Markdown with optional JSX, no custom components)\n"
        f"- Start with # {topic}\n"
        f"- 3-5 sections with ## headings\n"
        f"- STRICTLY relevant to \"{topic}\". Do not overlap with or redundantly cover other subtopics in the hierarchy.\n"
        f"- Use bullet points, numbered lists, code blocks where appropriate\n"
        f"- Educational, clear, well-structured\n"
        f"- 400-800 words\n"
        f"- No frontmatter\n"
        f"- Return ONLY the MDX content"
    )
    text = generate_content(prompt, ai_client=ai_client)
    return text.strip()


async def refine_mdx_content(
    full_mdx: str, selected_text: str, question: str, topic: str, context: str = "", ai_client=None
) -> str:
    ctx = f"\nReference material:\n<context>\n{context}\n</context>\n" if context else ""
    sel = f"\nSelected text to refine:\n<selected>\n{selected_text}\n</selected>\n" if selected_text else ""
    action = (
        "Rewrite ONLY the selected text, then return the COMPLETE document with that section replaced."
        if selected_text
        else "Refine the entire document according to the user's request."
    )
    prompt = (
        f"You are an expert technical writer refining educational MDX content.\n\n"
        f"Topic: \"{topic}\"\n{sel}\n"
        f"User request: \"{question}\"\n{ctx}\n"
        f"Full document:\n<document>\n{full_mdx}\n</document>\n\n"
        f"{action}\n\nReturn ONLY the complete updated MDX document."
    )
    text = generate_content(prompt, ai_client=ai_client)
    return text.strip()


async def generate_latex_content(topic: str, main_topic: str, context: str = "", hierarchy: str = "", ai_client=None) -> str:
    """Generate LaTeX content instead of MDX."""
    ctx = f"\nUse this reference material:\n<context>\n{context}\n</context>\n" if context else ""
    hier_ctx = f"\nHere is the full topic hierarchy for context:\n<hierarchy>\n{hierarchy}\n</hierarchy>\nStrictly focus ONLY on the topic '{topic}' and do not explain other topics from the hierarchy to avoid redundant content." if hierarchy else ""
    prompt = (
        f"You are an expert technical writer creating educational LaTeX content.\n\n"
        f"Generate comprehensive LaTeX content for: \"{topic}\"\n"
        f"Part of a document about: \"{main_topic}\"\n"
        f"{hier_ctx}\n"
        f"{ctx}\n"
        f"Requirements:\n"
        f"- Pure LaTeX format (NOT a full document — no \\documentclass, \\begin{{document}}, etc.)\n"
        f"- Start with \\section{{{topic}}}\n"
        f"- 3-5 subsections with \\subsection{{}}\n"
        f"- STRICTLY relevant to \"{topic}\". Do not overlap with or redundantly cover other subtopics.\n"
        f"- Use itemize/enumerate, equations, tables where appropriate\n"
        f"- Educational, clear, well-structured\n"
        f"- 400-800 words\n"
        f"- Return ONLY the LaTeX content (no preamble, no \\begin{{document}})\n"
    )
    text = generate_content(prompt, ai_client=ai_client)
    return text.strip()


# ---------------------------------------------------------------------------
# API Routes — mounted under /ai/
# ---------------------------------------------------------------------------

@app.post("/ai/search-topics")
async def search_topics(req: SearchTopicsRequest, ai_client=Depends(get_genai_client)):
    try:
        prompt = (
            f'Generate a structured topic hierarchy for learning about "{req.query}".\n\n'
            f"Return ONLY valid JSON in this format:\n"
            f'[{{"topic": "Main topic", "subtopics": ["Sub 1", "Sub 2"]}}]\n\n'
            f"Rules: 4-6 main topics, 2-4 subtopics each, logical progression, clear names."
        )
        text = generate_content(prompt, ai_client=ai_client)
        text = text.strip()
        clean = re.sub(r"^```json\s*", "", text, flags=re.I)
        clean = re.sub(r"\s*```$", "", clean)
        parsed = json.loads(clean)
        for i, item in enumerate(parsed):
            if "relevanceScore" not in item:
                item["relevanceScore"] = max(60, 95 - i * 5)
        return {"status": "success", "data": {"topics": "```json\n" + json.dumps(parsed, indent=2) + "\n```"}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- LLM-only generation ---

@app.post("/ai/generate-mdx-llm-only")
async def generate_mdx_llm_only(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        t = req.topic or req.selected_topic
        text = await generate_mdx_content(t, req.main_topic, "", req.hierarchy or "", ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": text}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-mdx-llm-only-raw", response_class=PlainTextResponse)
async def generate_mdx_llm_only_raw(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        t = req.topic or req.selected_topic
        text = await generate_mdx_content(t, req.main_topic, "", req.hierarchy or "", ai_client=ai_client)
        return PlainTextResponse(content=text)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Single-topic with crawl4ai web crawling ---

@app.post("/ai/single-topic")
async def single_topic(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_for_topic(req.selected_topic)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, req.hierarchy or '', ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": mdx}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/single-topic-raw", response_class=PlainTextResponse)
async def single_topic_raw(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_for_topic(req.selected_topic)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, req.hierarchy or '', ai_client=ai_client)
        return mdx
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- URL-based generation with crawl4ai ---

@app.post("/ai/generate-mdx-from-url")
async def generate_mdx_from_url(req: UrlMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_url(req.url)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, getattr(req, 'hierarchy', ''), ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": mdx}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-mdx-from-url-raw", response_class=PlainTextResponse)
async def generate_mdx_from_url_raw(req: UrlMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_url(req.url)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, getattr(req, 'hierarchy', ''), ai_client=ai_client)
        return mdx
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-mdx-from-urls")
async def generate_mdx_from_urls(req: UrlsMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_urls(req.urls)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, getattr(req, 'hierarchy', ''), ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": mdx}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-mdx-from-urls-raw", response_class=PlainTextResponse)
async def generate_mdx_from_urls_raw(req: UrlsMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_urls(req.urls)
        mdx = await generate_mdx_content(req.selected_topic, req.main_topic, context, getattr(req, 'hierarchy', ''), ai_client=ai_client)
        return mdx
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Refinement endpoints ---

@app.post("/ai/refine")
async def refine(req: RefineRequest, ai_client=Depends(get_genai_client)):
    try:
        refined = await refine_mdx_content(req.mdx, "", req.question, "", ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": refined}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-selection")
async def refine_with_selection(req: RefineWithSelectionRequest, ai_client=Depends(get_genai_client)):
    try:
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": refined}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-selection-raw", response_class=PlainTextResponse)
async def refine_with_selection_raw(req: RefineWithSelectionRequest, ai_client=Depends(get_genai_client)):
    try:
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, ai_client=ai_client)
        return refined
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-crawling")
async def refine_with_crawling(req: RefineWithCrawlingRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_url(f"https://en.wikipedia.org/wiki/{req.topic.replace(' ', '_')}")
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, context, ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": refined}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-crawling-raw", response_class=PlainTextResponse)
async def refine_with_crawling_raw(req: RefineWithCrawlingRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_url(f"https://en.wikipedia.org/wiki/{req.topic.replace(' ', '_')}")
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, context, ai_client=ai_client)
        return refined
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-urls")
async def refine_with_urls(req: RefineWithUrlsRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_urls(req.urls)
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, context[:15000], ai_client=ai_client)
        return {"status": "success", "data": {"mdx_content": refined}}
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/refine-with-urls-raw", response_class=PlainTextResponse)
async def refine_with_urls_raw(req: RefineWithUrlsRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_urls(req.urls)
        refined = await refine_mdx_content(req.mdx, req.selected_text, req.question, req.topic, context[:15000], ai_client=ai_client)
        return refined
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- LaTeX generation endpoints ---

@app.post("/ai/generate-latex-llm-only-raw", response_class=PlainTextResponse)
async def generate_latex_llm_only_raw(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        t = req.topic or req.selected_topic
        text = await generate_latex_content(t, req.main_topic, "", req.hierarchy or "", ai_client=ai_client)
        return PlainTextResponse(content=text)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-latex-crawl-raw", response_class=PlainTextResponse)
async def generate_latex_crawl_raw(req: GenerateMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_url(f"https://en.wikipedia.org/wiki/{req.selected_topic.replace(' ', '_')}")
        text = await generate_latex_content(req.selected_topic, req.main_topic, context, req.hierarchy or "", ai_client=ai_client)
        return PlainTextResponse(content=text)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/generate-latex-from-urls-raw", response_class=PlainTextResponse)
async def generate_latex_from_urls_raw(req: UrlsMdxRequest, ai_client=Depends(get_genai_client)):
    try:
        context = await crawl_urls(req.urls)
        text = await generate_latex_content(req.selected_topic, req.main_topic, context, req.hierarchy or "", ai_client=ai_client)
        return PlainTextResponse(content=text)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

