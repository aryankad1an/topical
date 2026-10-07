"""Small source-editing helpers for migrations.
edit(path, [(old, new), ...]) — each old must occur exactly once.
addnames(path, *names) — add names to the `@/components/ui` import (creating it after the last import)."""
import re


def edit(p, R):
    t = open(p).read()
    for a, b in R:
        assert t.count(a) == 1, (p, t.count(a), a[:80])
        t = t.replace(a, b)
    open(p, 'w').write(t)


def addnames(p, *names):
    t = open(p).read()
    m = re.search(r"import \{([^}]*)\} from ['\"]@/components/ui['\"];", t)
    if m:
        ns = [x.strip() for x in m.group(1).split(',') if x.strip()] + list(names)
        t = t.replace(m.group(0), "import { " + ', '.join(dict.fromkeys(ns)) + " } from '@/components/ui';")
    else:
        lines = t.split('\n')
        last = max(i for i, l in enumerate(lines) if l.startswith('import ') or (l.startswith('} from ') and i > 0))
        # an import may span lines; advance to the line that ends it
        while not lines[last].rstrip().endswith(';'):
            last += 1
        lines.insert(last + 1, "import { " + ', '.join(names) + " } from '@/components/ui';")
        t = '\n'.join(lines)
    open(p, 'w').write(t)
