"""crop.py NEWDIR TAG x0 y0 x1 y1 [OUT] — baseline vs new crop, stacked (red divider). Run from the output dir."""
import sys
from PIL import Image
nd, tag = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
out = sys.argv[7] if len(sys.argv) > 7 else 'crop.png'
a = Image.open(f'base/{tag}.png').convert('RGB'); b = Image.open(f'{nd}/{tag}.png').convert('RGB')
ca = a.crop((x0, y0, x1, y1)); cb = b.crop((x0, y0, x1, y1))
w, h = ca.size
c = Image.new('RGB', (w, h * 2 + 4), (255, 0, 0)); c.paste(ca, (0, 0)); c.paste(cb, (0, h + 4))
s = min(1.0, 1600 / w)
if s < 1:
    c = c.resize((int(c.width * s), int(c.height * s)))
c.save(out)
