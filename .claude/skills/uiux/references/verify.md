# Browser verification

Run this for every route you touched. Use the project's dev server (`project.md` → Commands) through the browser tools. **Measure; don't eyeball.** Take a screenshot only as final proof.

If a route needs sign-in and you can't sign in, verify it through a temporary fixture route that renders the real components against fixture data. Delete the fixture afterwards. `project.md` says whether this applies.

## Matrix

For each touched route and each meaningful state (empty / loading / error / populated / overflowing):
- **widths:** 360, 768, 1280, 1920 (`resize_window` with a custom width, then reload)
- **themes:** every value of `<THEME_ATTR>` (set it with `document.documentElement.dataset.theme = '…'`, or use the app's own switch)
- **reduced motion:** once per route with `prefers-reduced-motion: reduce`. If the browser tool can't emulate it, assert the CSS/JS guard exists instead, and say so.

## 1. Overflow

```js
(() => {
  const vw = document.documentElement.clientWidth;
  const page = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const offenders = [...document.querySelectorAll('body *')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.right > vw + 0.5; })
    .filter(el => !el.closest('[style*="overflow"], .overflow-x-auto, pre, table'))
    .slice(0, 15)
    .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(el.getBoundingClientRect().right)}`);
  return { vw, page, overflow: page > vw, offenders };
})()
```

- Pass means `overflow: false` and no offenders.
- `overflow-x: hidden` on html/body hides the page scrollbar, not the problem. Offenders still fail.

## 2. Layout shift

Run this before the action or load, perform the action (or reload), then read the value:

```js
window.__cls = 0;
new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; }))
  .observe({ type: 'layout-shift', buffered: true });
```

- Pass: `__cls` < 0.1, and no shift at all when an async badge, message or row appears.
- Store the value in a DOM attribute if the tool doesn't keep window globals between calls.

## 3. Keyboard & focus

1. Focus `body`, then press Tab repeatedly. At each stop, record:

```js
(() => { const a = document.activeElement, cs = getComputedStyle(a);
  return { el: a.tagName + '.' + a.className, name: a.getAttribute('aria-label') || a.textContent.trim().slice(0,40),
    outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, ring: cs.boxShadow !== 'none' }; })()
```

2. Pass conditions:
   - Tab order follows reading order.
   - Every stop has an accessible name.
   - Every stop shows a ring: an `outline` or `box-shadow` on the element, or on an ancestor via `:focus-within`.
3. Check the keys: **Enter** activates or submits, and **Escape** closes the topmost overlay with focus returning to its trigger. Arrows move within menus, lists and tabs.

## 4. Contrast

Sample the text and non-text UI in each state and theme:

```js
(() => {
  const lum = c => { const [r,g,b] = c.match(/[\d.]+/g).slice(0,3).map(v => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r+0.7152*g+0.0722*b; };
  const bg = el => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!/rgba\(.*,\s*0\)|transparent/.test(c)) return c; } return getComputedStyle(document.body).backgroundColor; };
  const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
  return [...document.querySelectorAll('p,span,a,button,label,h1,h2,h3,li,td,input')].filter(e => e.offsetParent && e.textContent.trim())
    .slice(0,80).map(e => ({ t: e.textContent.trim().slice(0,30), r: +ratio(getComputedStyle(e).color, bg(e)).toFixed(2) }))
    .filter(x => x.r < 4.5);
})()
```

- Floors: 4.5 for body text; 3.0 for large text (≥24px, or ≥18.66px bold) and for control borders, focus rings and meaningful icons.
- Translucent backgrounds make the ancestor walk approximate. Confirm borderline hits by eye in a zoomed screenshot.

## 5. Console

Run `read_console_messages` with `onlyErrors`. It must be clean, apart from errors listed as pre-existing in the ledger.

## 6. Changed primitives

For every primitive you created or changed, run steps 1–4 on **at least two different call sites**, preferably in different areas. Also check the disabled, loading and error states wherever the primitive has them.

## 7. Proof

After everything passes, take one screenshot per touched route at 1280 in the default theme. Add 360 if the layout archetype changes at that width.

Report the matrix in one line, for example: `360/768/1280/1920 × light/dark × reduced: overflow 0, CLS 0.00, focus ok, contrast ok, console clean`.
