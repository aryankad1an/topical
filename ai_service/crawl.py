"""Web crawling helpers.

crawl4ai when it is importable (Python 3.10+ with the headless browser
installed), a urllib + BeautifulSoup fetch otherwise, so a missing browser
degrades to plain text rather than failing the request.
"""

import asyncio
import json
import logging
import re
from typing import List

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Web crawling (crawl4ai with a urllib fallback)
# ---------------------------------------------------------------------------
async def crawl_url(url: str) -> str:
    """Extract clean text content from a URL, falling back to a basic fetch."""
    try:
        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            if result and result.markdown:
                return result.markdown[:15000]
            return ""
    except (ImportError, TypeError):
        # crawl4ai unavailable (e.g. Python < 3.10) — degrade gracefully.
        logger.warning("crawl4ai not available, falling back to basic fetch")
        return await _basic_fetch(url)
    except Exception as e:
        logger.warning(f"crawl4ai error for {url}: {e}, falling back to basic fetch")
        return await _basic_fetch(url)


async def _basic_fetch(url: str) -> str:
    """Robust fallback URL fetcher using urllib + BeautifulSoup for text extraction."""
    import urllib.request
    import ssl
    from bs4 import BeautifulSoup

    try:
        # Permissive SSL context for sites with cert issues.
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

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        # Blank line before headings/paragraphs, single line between list items,
        # matching the markdown-ish shape the LLM prompts expect.
        for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p"]):
            tag.insert_before("\n\n")
        for li in soup.find_all("li"):
            li.insert_before("\n- ")

        text = soup.get_text(separator=" ", strip=True)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        return text[:15000]
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return f"[Failed to fetch content from {url}]"


async def crawl_for_topic(topic: str) -> str:
    """Crawl Wikipedia for a topic, with the REST summary API as a fallback."""
    wiki_url = f"https://en.wikipedia.org/wiki/{topic.replace(' ', '_')}"
    content = await crawl_url(wiki_url)
    if content and "[Failed to fetch" not in content and len(content) > 200:
        return content
    try:
        import urllib.request
        api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{topic.replace(' ', '_')}"
        req = urllib.request.Request(api_url, headers={"User-Agent": "Topical/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("extract"):
            return f"# {data.get('title', topic)}\n\n{data['extract']}"
    except Exception:
        pass
    return content or ""


async def crawl_urls(urls: List[str]) -> str:
    """Crawl multiple URLs concurrently and join the successful results."""
    results = await asyncio.gather(*(crawl_url(u) for u in urls), return_exceptions=True)
    valid = [r for r in results if isinstance(r, str) and r and "[Failed to fetch" not in r]
    return "\n\n---\n\n".join(valid)[:20000]
