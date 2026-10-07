// Text-contrast probe for probe.py: every visible element with its own text,
// its composited ink against its composited ground. Approximate: background
// images and backdrop filters are ignored (the nearest solid colour is used).
() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => { const a = top[3]; return [0,1,2].map(i => top[i]*a + bot[i]*(1-a)).concat(1); };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; };
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const ground = el => { const layers = []; let opacity = 1;
    for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e);
      opacity *= parseFloat(cs.opacity); const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; } }
    let g = parse(getComputedStyle(document.body).backgroundColor) || [255,255,255,1];
    for (let i = layers.length - 1; i >= 0; i--) g = over(layers[i], g);
    return [g, opacity]; };
  const fails = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[aria-hidden="true"], [inert], svg, .sr-only, :disabled, [aria-disabled="true"]')) continue;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ');
    if (!text) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    const [g, op] = ground(el); let ink = parse(cs.color); if (!ink) continue;
    ink = over([ink[0], ink[1], ink[2], ink[3]*op], g);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
    const cr = ratio(ink, g);
    if (cr < need - 0.05) fails.push([el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0], text.slice(0, 30), Math.round(cr*100)/100, need]);
  }
  return fails;
}
