"""Count source (.ts/.tsx) occurrences of each class token. Built-at-runtime
class families must still be checked by hand (see project.md).
usage: usage.py class [class ...]   → prints `count class` (0 = no source use)"""
import glob, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
src = {f: open(f).read() for f in glob.glob(os.path.join(ROOT, 'frontend', 'src', '**', '*.ts*'), recursive=True)}
for c in sys.argv[1:]:
    pat = re.compile(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])')
    n = sum(len(pat.findall(t)) for t in src.values())
    where = sorted({f.split('src/')[1] for f, t in src.items() if pat.search(t)})
    print(f'{n:3} {c}  {" ".join(where)[:120]}')
