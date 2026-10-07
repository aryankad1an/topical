"""Capture full-page screenshots + computed-style fingerprints for every route state.

usage: capture.py OUTDIR [name-filter] [--widths 360,1280] [--themes light,dark] [--tags FILE]
env:   HARNESS_BASE (default http://localhost:5173) — the dev server to capture.

The API is fulfilled from fixtures.py, the websocket is stubbed, the clock is
frozen and motion is reduced, so two captures of the same code match pixel
for pixel. Each capture gets its own browser so one crash cannot take out
the run.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
from fixtures import respond

BASE = os.environ.get("HARNESS_BASE", "http://localhost:5173")


async def open_cmdk(page):
    await page.keyboard.press("Meta+k")
    await page.wait_for_timeout(300)


async def list_view(page):
    btn = page.locator("[aria-label*='List' i], button:has-text('List')").first
    if await btn.count():
        await btn.click()
        await page.wait_for_timeout(300)


async def open_post(page):
    await page.locator("text=How do you structure a survey document?").first.click()
    await page.wait_for_timeout(600)


async def new_post(page):
    b = page.locator("button:has-text('New post'), button:has-text('New Post')").first
    if await b.count():
        await b.click()
        await page.wait_for_timeout(400)


async def tab(name):
    async def f(page):
        await page.locator(f"button:has-text('{name}'), [role=tab]:has-text('{name}')").first.click()
        await page.wait_for_timeout(500)
    return f


async def mobile_menu(page):
    b = page.locator("[aria-label='Open menu']")
    if await b.count() and await b.first.is_visible():
        await b.first.click()
        await page.wait_for_timeout(300)


def keys(combo):
    async def f(page):
        await page.locator("textarea").first.click()
        await page.keyboard.press(combo)
        await page.wait_for_timeout(400)
    return f


async def ai_selection(page):
    ta = page.locator("textarea").first
    await ta.click()
    await ta.evaluate("t => { t.focus(); t.setSelectionRange(0, 40); t.dispatchEvent(new Event('select', {bubbles: true})); }")
    await page.keyboard.press("Meta+j")
    await page.wait_for_timeout(400)


async def export_pdf(page):
    await page.locator("[aria-label='Export']").first.click()
    await page.wait_for_timeout(200)
    await page.locator("text=Export PDF").first.click()
    await page.wait_for_timeout(400)


async def coauthors(page):
    await page.locator("[aria-label$='on this document']").first.click()
    await page.wait_for_timeout(200)
    await page.locator("text=Manage collaborators").first.click()
    await page.wait_for_timeout(400)


# name, path, authed, fixture variant, action, widths override
STATES = [
    ("home", "/", False, "full", None, None),
    ("about", "/about", False, "full", None, None),
    ("login", "/login", False, "full", None, None),
    ("register", "/register", False, "full", None, None),
    ("community-anon", "/community", False, "full", None, None),
    ("community", "/community", True, "full", None, None),
    ("community-lessons", "/community", True, "full", "tab:Lessons", None),
    ("community-people", "/community", True, "full", "tab:People", None),
    ("community-empty", "/community", True, "empty", None, None),
    ("post-detail", "/community", True, "full", "open_post", None),
    ("new-post", "/community", True, "full", "new_post", None),
    ("person", "/u/alice", False, "full", None, None),
    ("person-missing", "/u/nobody", False, "full", None, None),
    ("projects", "/projects", True, "full", None, None),
    ("projects-list", "/projects", True, "full", "list_view", None),
    ("projects-empty", "/projects", True, "empty", None, None),
    ("profile", "/profile", True, "full", None, None),
    ("profile-edit", "/profile/edit", True, "full", None, None),
    ("providers", "/providers", True, "full", None, None),
    ("doc-read", "/projects/mdx/101", False, "full", None, None),
    ("doc-read-latex", "/projects/latex/102", True, "full", None, None),
    ("doc-write", "/projects/mdx/101?mode=write", True, "full", None, None),
    ("doc-write-latex", "/projects/latex/102?mode=write", True, "full", None, None),
    ("doc-missing", "/projects/mdx/999", True, "full", None, None),
    ("doc-blank-read", "/projects/mdx/104", False, "full", None, [1280]),
    ("doc-blank-write", "/projects/mdx/104?mode=write", True, "full", None, [1280]),
    ("cmdk", "/projects", True, "full", "cmdk", None),
    ("mobile-menu", "/community", True, "full", "mobile_menu", [360]),
    ("signed-out-gate", "/projects", False, "full", None, None),
    ("notfound", "/this-does-not-exist", False, "full", None, None),
    ("ov-shortcuts", "/projects/mdx/101?mode=write", True, "full", "k:Meta+/", [1280]),
    ("ov-find", "/projects/mdx/101?mode=write", True, "full", "k:Meta+f", [1280]),
    ("ov-ai", "/projects/mdx/101?mode=write", True, "full", "ai_selection", [1280]),
    ("ov-ai-nosel", "/projects/mdx/101?mode=write", True, "full", "k:Meta+j", [1280]),
    ("ov-export-pdf", "/projects/mdx/101?mode=write", True, "full", "export_pdf", [1280]),
    ("ov-coauthors", "/projects/mdx/101?mode=write", True, "full", "coauthors", [1280]),
]

ACTIONS = {"cmdk": open_cmdk, "list_view": list_view, "open_post": open_post,
           "new_post": new_post, "mobile_menu": mobile_menu,
           "ai_selection": ai_selection, "export_pdf": export_pdf, "coauthors": coauthors}

FINGERPRINT_JS = r"""
() => {
  const props = ['display','position','color','backgroundColor','borderTopColor','borderTopWidth','borderRadius',
    'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom',
    'paddingLeft','boxShadow','opacity','gap','textTransform','outlineStyle'];
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT','STYLE','svg','path'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 40);
    out.push({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120), text,
      box: [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)],
      s: props.map(p => cs[p]).join('|') });
  }
  const vw = document.documentElement.clientWidth;
  const page = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  return { els: out, overflow: page > vw + 1, vw, page };
}
"""


async def prepare(browser, st, width, theme):
    """A page loaded at a route state, ready to inspect."""
    name, path, authed, variant, action, _ = st
    ctx = await browser.new_context(viewport={"width": width, "height": 900}, reduced_motion="reduce",
                                    color_scheme=theme, device_scale_factor=1)
    await ctx.add_init_script(f"try {{ localStorage.setItem('topical_theme', '{theme}'); }} catch (e) {{}}")
    page = await ctx.new_page()
    page.set_default_timeout(20000)
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    async def api(route):
        req = route.request
        status, body = respond(req.url[len(BASE):], req.method, variant, authed)
        await route.fulfill(status=status, content_type="application/json", body=json.dumps(body))
    await page.route("**/api/**", api)
    await page.route_web_socket("**/ws/**", lambda ws: None)
    await page.clock.install(time=1790000000)
    await page.goto(BASE + path, wait_until="networkidle")
    await page.evaluate("document.fonts.ready")
    await page.wait_for_function("document.fonts.status === 'loaded'")
    # Nudge the viewport so anything that measured before the webfonts landed
    # (the code surface's wrap width) measures again against the real faces.
    await page.set_viewport_size({"width": width, "height": 901})
    await page.wait_for_timeout(150)
    await page.set_viewport_size({"width": width, "height": 900})
    await page.clock.run_for(1500)
    await page.wait_for_timeout(500)
    if action:
        if action.startswith("tab:"):
            await (await tab(action[4:]))(page)
        elif action.startswith("k:"):
            await keys(action[2:])(page)
        else:
            await ACTIONS[action](page)
        await page.clock.run_for(800)
        await page.wait_for_timeout(300)
    await page.mouse.move(0, 0)
    return ctx, page, errors


async def capture_one(browser, outdir, st, width, theme):
    ctx, page, errors = await prepare(browser, st, width, theme)
    fp = await page.evaluate(FINGERPRINT_JS)
    fp["errors"] = errors
    fp["url"] = page.url
    tag = f"{st[0]}@{width}-{theme}"
    await page.screenshot(path=os.path.join(outdir, tag + ".png"), full_page=True)
    with open(os.path.join(outdir, tag + ".json"), "w") as f:
        json.dump(fp, f)
    await ctx.close()
    return tag, fp["overflow"], len(errors)


async def main():
    outdir = sys.argv[1]
    filt = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else ""
    widths, themes, only = [360, 1280], ["light", "dark"], None
    for i, a in enumerate(sys.argv):
        if a == "--widths": widths = [int(x) for x in sys.argv[i + 1].split(",")]
        if a == "--themes": themes = sys.argv[i + 1].split(",")
        if a == "--tags": only = set(open(sys.argv[i + 1]).read().split())
    os.makedirs(outdir, exist_ok=True)
    async with async_playwright() as p:
        sem = asyncio.Semaphore(5)

        async def run(st, w, t):
            async with sem:
                browser = await p.chromium.launch()
                try:
                    return await capture_one(browser, outdir, st, w, t)
                except Exception as e:
                    return f"{st[0]}@{w}-{t}", "ERR", str(e).splitlines()[0][:160]
                finally:
                    await browser.close()
        jobs = [run(st, w, t) for st in STATES if filt in st[0]
                for w in (st[5] or widths) for t in themes
                if only is None or f"{st[0]}@{w}-{t}" in only]
        for r in await asyncio.gather(*jobs):
            print(*r)


if __name__ == "__main__":
    asyncio.run(main())
