"""Compare a capture dir against every baseline run (base/, baseB/) in the cwd.
A capture counts as different only if it differs from all of them.
usage (from the output dir): diff.py NEW [filter]"""
import os, sys
import numpy as np
from PIL import Image

new = sys.argv[1]
filt = sys.argv[2] if len(sys.argv) > 2 else ''
bases = [b for b in ('base', 'baseB') if os.path.isdir(b)]
os.makedirs(os.path.join(new, '_diff'), exist_ok=True)
bad = []


def compare(bp, np_):
    a = np.asarray(Image.open(bp).convert('RGB')).astype(int)
    b = np.asarray(Image.open(np_).convert('RGB')).astype(int)
    size = a.shape != b.shape
    h = min(a.shape[0], b.shape[0]); w = min(a.shape[1], b.shape[1])
    d = np.abs(a[:h, :w] - b[:h, :w]).max(axis=2) > 8
    return size, a.shape[:2], b.shape[:2], d, b[:h, :w]


for fn in sorted(os.listdir(new)):
    if not fn.endswith('.png') or filt not in fn:
        continue
    tag = fn[:-4]
    best = None
    for bdir in bases:
        bp = os.path.join(bdir, fn)
        if not os.path.exists(bp):
            continue
        r = compare(bp, os.path.join(new, fn))
        score = (r[0], int(r[3].sum()))
        if best is None or score < best[0]:
            best = (score, r)
    if best is None:
        print(f'{tag:40} NEW (no baseline)')
        continue
    (size, n), (_, sa, sb, d, arr) = best
    if size or n:
        bad.append(tag)
        msg = f'SIZE {sa}->{sb} ' if size else ''
        if n:
            ys, xs = np.nonzero(d)
            msg += f'{n:7d}px bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}'
            out = arr.astype('uint8').copy(); out[d] = [255, 0, 255]
            Image.fromarray(out).save(os.path.join(new, '_diff', fn))
        print(f'{tag:40} {msg}')
print(f'-- {len(bad)} differing captures')
open(os.path.join(new, '_bad.txt'), 'w').write('\n'.join(bad))
