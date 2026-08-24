"""Fetching the reference material a grounded section is written from.

Two strategies, in order of preference: crawl4ai when it is importable (Python
3.10+ with the headless browser installed), and a urllib + BeautifulSoup fetch
otherwise — so a missing browser degrades to plain text rather than failing the
request.

Everything here is called from async request handlers, so every blocking call
is pushed to a worker thread. urllib is synchronous, and awaiting it inline
would stall *every* concurrent request for the length of a page load — the same
reason `generate_content` in `providers.py` is async all the way down.

Failure is a return of `None`, never a string. A "[Failed to fetch …]"
placeholder used to be returned instead and then string-matched by the callers
to decide whether the fetch had worked, which meant a page that merely
contained that phrase counted as a failure, and a caller that forgot the check
passed the placeholder to the model as if it were research.
"""

import asyncio
import json
import logging
import re
import ssl
import urllib.request
from typing import List, Optional

logger = logging.getLogger(__name__)

#: Per-page cap. Enough for a long article, short of blowing the context window.
MAX_PAGE_CHARS = 15_000
#: Cap on a whole multi-page batch, which is concatenated into one prompt.
MAX_BATCH_CHARS = 20_000
#: Below this, a "successful" fetch is a cookie wall or an error page.
MIN_USEFUL_CHARS = 200

_FETCH_TIMEOUT_SECONDS = 30
_SUMMARY_TIMEOUT_SECONDS = 15

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


# ---------------------------------------------------------------------------
# One page
# ---------------------------------------------------------------------------
async def crawl_url(url: str) -> Optional[str]:
    """Extract readable text from a URL, or None if it cannot be read.

    crawl4ai renders the page in a real browser, which is the only way to get
    anything useful out of a client-rendered site. When it is unavailable or
    fails, the plain fetch below still handles the server-rendered majority.
    """
    try:
        from crawl4ai import AsyncWebCrawler

        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            if result and result.markdown:
                return result.markdown[:MAX_PAGE_CHARS]
            return None
    except (ImportError, TypeError):
        # crawl4ai unavailable (e.g. Python < 3.10) — degrade, don't fail.
        logger.warning("crawl4ai not available; falling back to a plain fetch")
    except Exception as exc:
        logger.warning("crawl4ai failed for %s (%s); falling back", url, exc)

    return await asyncio.to_thread(_fetch_text, url)


def _fetch_text(url: str) -> Optional[str]:
    """Blocking fetch + text extraction. Always called via `asyncio.to_thread`."""
    try:
        html = _read(url, _BROWSER_HEADERS, _FETCH_TIMEOUT_SECONDS, permissive_tls=True)
        return _extract_text(html)
    except Exception as exc:
        logger.error("Could not fetch %s: %s", url, exc)
        return None


def _read(url: str, headers: dict, timeout: int, permissive_tls: bool = False) -> str:
    """Read a URL as text. Blocking.

    `permissive_tls` skips certificate verification, which is wrong in general
    and right here: the content is only ever read, summarised and shown to the
    person who asked for that exact URL, and a lapsed certificate on a source
    page is not a reason to refuse to read it.
    """
    context = None
    if permissive_tls:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        return response.read().decode("utf-8", errors="ignore")


def _extract_text(html: str) -> Optional[str]:
    """Strip a page down to the prose, in the markdown-ish shape prompts expect."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    # Blank line before each heading and paragraph, one line per list item —
    # without these the whole page collapses into a single run-on line.
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p"]):
        tag.insert_before("\n\n")
    for item in soup.find_all("li"):
        item.insert_before("\n- ")

    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_PAGE_CHARS] or None


# ---------------------------------------------------------------------------
# Topic research
# ---------------------------------------------------------------------------
async def crawl_for_topic(topic: str) -> str:
    """Research a topic on Wikipedia, falling back to its REST summary.

    The summary API is the fallback rather than the first choice because it
    returns one paragraph where the article gives a whole page — but one solid
    paragraph still beats the empty string, which is what the caller gets when
    a title does not resolve or the article is a stub.
    """
    slug = topic.replace(" ", "_")

    article = await crawl_url(f"https://en.wikipedia.org/wiki/{slug}")
    if article and len(article) > MIN_USEFUL_CHARS:
        return article

    summary = await asyncio.to_thread(_wikipedia_summary, slug, topic)
    return summary or article or ""


def _wikipedia_summary(slug: str, topic: str) -> Optional[str]:
    """The REST summary for a title, as a heading plus its extract. Blocking."""
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}"
    try:
        raw = _read(url, {"User-Agent": "Topical/1.0"}, _SUMMARY_TIMEOUT_SECONDS)
        data = json.loads(raw)
    except Exception as exc:
        logger.info("No Wikipedia summary for %r: %s", topic, exc)
        return None

    extract = data.get("extract")
    return f"# {data.get('title', topic)}\n\n{extract}" if extract else None


# ---------------------------------------------------------------------------
# Several pages
# ---------------------------------------------------------------------------
async def crawl_urls(urls: List[str]) -> str:
    """Read every URL concurrently and join whatever came back.

    One unreachable page does not sink the batch: `return_exceptions` keeps the
    others, and the writer gets a section grounded in the sources that did
    load rather than an error naming the one that did not.
    """
    results = await asyncio.gather(*(crawl_url(url) for url in urls), return_exceptions=True)
    pages = [r for r in results if isinstance(r, str) and r]
    return "\n\n---\n\n".join(pages)[:MAX_BATCH_CHARS]
