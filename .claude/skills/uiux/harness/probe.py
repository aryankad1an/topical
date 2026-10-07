"""Run a JS probe over every state. usage: probe.py OUT.json JSFILE [--widths 1280,360] [--themes light,dark]"""
import asyncio, json, sys
from playwright.async_api import async_playwright
import capture as C


async def main():
    out, jsf = sys.argv[1], sys.argv[2]
    widths, themes = [1280, 360], ['light']
    if '--themes' in sys.argv:
        themes = sys.argv[sys.argv.index('--themes') + 1].split(',')
    if '--widths' in sys.argv:
        widths = [int(x) for x in sys.argv[sys.argv.index('--widths') + 1].split(',')]
    js = open(jsf).read()
    res = {}
    async with async_playwright() as p:
        sem = asyncio.Semaphore(5)

        async def run(st, w, t):
            async with sem:
                b = await p.chromium.launch()
                try:
                    ctx, page, _ = await C.prepare(b, st, w, t)
                    res[f"{st[0]}@{w}-{t}"] = await page.evaluate(js)
                except Exception as e:
                    res[f"{st[0]}@{w}-{t}"] = {"error": str(e)[:200]}
                finally:
                    await b.close()
        await asyncio.gather(*[run(st, w, t) for st in C.STATES for w in (st[5] or widths) for t in themes])
    json.dump(res, open(out, 'w'), indent=1)


asyncio.run(main())
