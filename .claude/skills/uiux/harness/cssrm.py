"""Remove whole CSS rules whose selector matches exactly (whitespace-normalised),
plus a comment block that immediately precedes a removed rule. Rules nested in
@media blocks are matched too; an @media left empty must be removed by hand.
Gate every use with cssdiff.py against the previous build.
usage: from cssrm import remove_rules; found, missing = remove_rules(path, [selector, ...])"""
import re


def _norm(s):
    return ' '.join(s.split())


def remove_rules(path, selectors):
    t = open(path).read()
    want = {_norm(s) for s in selectors}
    found = set(); pos = 0; res = ''
    pat = re.compile(r'([^{}]*)\{')
    while True:
        m = pat.search(t, pos)
        if not m:
            res += t[pos:]; break
        pre = m.group(1)
        cut = pre.rfind('*/') + 2 if '*/' in pre else 0
        sel = pre[cut:]
        if _norm(sel) in want and not sel.strip().startswith('@'):
            close = t.index('}', m.end())
            head = pre[:cut]
            cm = re.search(r'/\*(?:(?!\*/).)*\*/\s*$', head, re.S)
            if cm and '\n\n' not in head[cm.end():]:
                head = head[:cm.start()]
            res += t[pos:m.start()] + head.rstrip(' \t')
            found.add(_norm(sel))
            pos = close + 1
            if t[pos:pos + 1] == '\n':
                pos += 1
            # keep the next rule on its own line
            if res and not res.endswith('\n') and pos < len(t) and t[pos] not in '\n':
                res += '\n'
        else:
            res += t[pos:m.end()]
            pos = m.end()
    open(path, 'w').write(res)
    return sorted(found), sorted(want - found)


def keep_props(path, selector, props, comment=None):
    """Reduce the (unique, top-level) rule for `selector` to the listed properties.
    Its own comment is replaced by `comment` when given."""
    t = open(path).read()
    pat = re.compile(r'(^|\n)([ \t]*)' + re.escape(selector) + r'\s*\{([^{}]*)\}')
    ms = list(pat.finditer(t))
    assert len(ms) == 1, (path, selector, len(ms))
    m = ms[0]
    decls = [d.strip() for d in re.sub(r'/\*.*?\*/', '', m.group(3), flags=re.S).split(';') if d.strip()]
    kept = [d for d in decls if d.split(':', 1)[0].strip() in props]
    body = selector + ' { ' + '; '.join(kept) + ('; ' if kept else '') + '}'
    if comment:
        body = '/* ' + comment + ' */\n' + body
    t = t[:m.start()] + m.group(1) + m.group(2) + body + t[m.end():]
    open(path, 'w').write(t)
    return kept
