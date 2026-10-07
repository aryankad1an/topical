"""Remove unused imported names reported by eslint (no-unused-vars) from import lines."""
import json, os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
out = subprocess.run(['npx', 'eslint', 'src', '--ext', 'ts,tsx', '-f', 'json'], capture_output=True, text=True, cwd=os.path.join(ROOT, 'frontend')).stdout
for f in json.loads(out):
    names = [re.match(r"'(\w+)' is defined but never used", m['message']).group(1)
             for m in f['messages'] if m.get('ruleId') == '@typescript-eslint/no-unused-vars' and 'is defined but never used' in m['message']]
    if not names: continue
    t = open(f['filePath']).read()
    def fix(m):
        items = [x.strip() for x in m.group(1).split(',') if x.strip()]
        keep = [x for x in items if x.split(' as ')[-1].strip() not in names]
        if not keep: return ''
        return m.group(0).replace(m.group(1), ' ' + ', '.join(keep) + ' ' if m.group(1).startswith(' ') else ', '.join(keep))
    t2 = re.sub(r'^import \{([^}]*)\} from [^;]+;\n?', lambda m: fix(m) if any(n in m.group(1) for n in names) else m.group(0), t, flags=re.M)
    open(f['filePath'], 'w').write(t2)
    print(f['filePath'].split('src/')[1], names)
