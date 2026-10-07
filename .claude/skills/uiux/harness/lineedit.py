"""Exact, line-anchored replacements: apply([(file, line, old, new), ...])."""
def apply(edits):
    by = {}
    for f, ln, old, new in edits:
        by.setdefault(f, []).append((ln, old, new))
    for f, es in by.items():
        lines = open(f).read().split('\n')
        for ln, old, new in es:
            assert lines[ln - 1].count(old) == 1, f'{f}:{ln} expected 1x {old!r} in {lines[ln - 1]!r}'
            lines[ln - 1] = lines[ln - 1].replace(old, new)
        open(f, 'w').write('\n'.join(lines))
    print('applied', len(edits))
