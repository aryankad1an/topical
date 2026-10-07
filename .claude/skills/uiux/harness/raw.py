"""List raw styled host elements (A1 detector) in the given files: line, tag, classes."""
import re, sys
RAW = re.compile(r'<([a-z][a-z0-9]*)\b([^>]*?)\b(className|style)=(\{[^}]*\}\}?|"[^"]*")', re.S)
for f in sys.argv[1:]:
    t = open(f).read()
    for m in RAW.finditer(t):
        line = t[:m.start()].count('\n') + 1
        print(f'{f.split("src/")[-1]}:{line} <{m.group(1)}> {m.group(3)}={m.group(4)[:110]}')
