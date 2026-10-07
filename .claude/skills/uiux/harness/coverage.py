"""Primitive-coverage proxy per audit area (see ../references/audit.md).
coverage = P / (P + R): P = JSX uses of components/ui exports; R = lowercase host
elements carrying className= or style=. usage: coverage.py [-v]"""
import re, glob, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
os.chdir(os.path.join(ROOT, 'frontend', 'src'))
prims = set()
for f in glob.glob('components/ui/*.tsx'):
    t = open(f).read()
    prims |= set(re.findall(r'export (?:function|const) ([A-Z]\w+)', t))
    for m in re.findall(r'export \{([^}]*)\}', t):
        prims |= set(x.strip() for x in m.split(',') if x.strip()[:1].isupper())
G = lambda p: sorted(glob.glob(p, recursive=True))
areas = {
    'shell': ['routes/__root.tsx', 'routes/_authenticated.tsx', 'components/CommandPalette.tsx',
              'components/OnboardingModal.tsx', 'components/ThemeToggle.tsx', 'components/BrandMark.tsx'],
    'document': ['routes/projects.$format.$id.tsx'] + G('features/editor/**/*.tsx') + G('features/preview/*.tsx')
                + ['components/Collaborators.tsx'],
    'workspace': ['routes/_authenticated/projects.tsx'] + G('components/projects/*.tsx'),
    'community': ['routes/community.tsx'] + G('components/community/*.tsx'),
    'marketing': ['routes/index.tsx', 'routes/about.tsx'] + G('features/home/*.tsx'),
    'account': ['routes/_authenticated/profile.tsx', 'routes/_authenticated/profile_.edit.tsx',
                'routes/_authenticated/providers.tsx', 'routes/u.$username.tsx', 'components/ProfileEditorFields.tsx',
                'components/auth/ChangePasswordCard.tsx', 'components/ProviderTile.tsx'],
    'auth': ['routes/login.tsx', 'routes/register.tsx', 'components/auth/AuthCard.tsx'],
}
RAW = re.compile(r'<[a-z][a-z0-9]*\b[^>]*?\b(?:className|style)=', re.S)
tp = tr = 0
for a, fs in areas.items():
    p = r = 0
    for f in fs:
        if not os.path.exists(f):
            continue
        t = open(f).read()
        r += len(RAW.findall(t))
        p += len([m for m in re.findall(r'<([A-Z]\w*)\b', t) if m in prims])
    tp += p; tr += r
    print(f"{a:10} P={p:4} R={r:4} coverage={100 * p / max(1, p + r):5.1f}%")
print(f"{'ALL':10} P={tp:4} R={tr:4} coverage={100 * tp / max(1, tp + tr):5.1f}%")
if '-v' in sys.argv:
    for a, fs in areas.items():
        for f in fs:
            if os.path.exists(f):
                n = len(RAW.findall(open(f).read()))
                if n: print(f'   {n:4} {a:9} {f}')
