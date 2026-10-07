"""Rule-by-rule diff of two compiled CSS files (comments stripped).
usage: cssdiff.py OLD.css NEW.css [--changed]"""
import re, sys, collections


def parse(t):
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    out = collections.OrderedDict(); stack = []; buf = ''
    for ch in t:
        if ch == '{':
            stack.append(buf.strip()); buf = ''
        elif ch == '}':
            if buf.strip():
                out.setdefault(' >> '.join(stack), []).append(buf.strip())
            buf = ''
            if stack:
                stack.pop()
        else:
            buf += ch
    return out


a = parse(open(sys.argv[1]).read()); b = parse(open(sys.argv[2]).read())
gone = [k for k in a if k not in b]; new = [k for k in b if k not in a]
chg = [k for k in a if k in b and a[k] != b[k]]
print(f'rules: {len(a)} -> {len(b)}; removed {len(gone)}, added {len(new)}, changed {len(chg)}')
for k in gone: print('  - ', k[:150])
for k in new: print('  + ', k[:150])
if '--changed' in sys.argv:
    for k in chg:
        da = set(';'.join(a[k]).split(';')); db = set(';'.join(b[k]).split(';'))
        print('  ~ ', k[:90], '|', sorted(da - db)[:3], '->', sorted(db - da)[:3])
