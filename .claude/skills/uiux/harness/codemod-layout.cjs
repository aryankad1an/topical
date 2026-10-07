// Rewrite raw elements whose className is only layout / typography utilities
// into Row / Stack / Grid / Text. Anything carrying appearance (colour fills,
// borders, feature classes) is left alone and reported for manual work.
// usage: node codemod-layout.cjs [--dry] file...
const ts = require(require('path').resolve(__dirname, '../../../../frontend/node_modules/typescript'));
const fs = require('fs');
const dry = process.argv.includes('--dry');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));

const SPACE = new Set(['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '8', '10', '12']);
const TXT_SIZE = { 'text-xs': 'xs', 'text-sm': 'sm', 'text-base': 'base', 'text-lg': 'lg', 'text-xl': 'xl', 'text-2xl': '2xl',
  'text-[10px]': '3xs', 'text-[11px]': '2xs', 'text-[10.5px]': '2xs', 'text-[11.5px]': '2xs' };
const TONE = { 'text-[var(--ink)]': 'ink', 'text-[var(--ink-2)]': 'ink-2', 'text-[var(--ink-muted)]': 'muted', 'text-muted-foreground': 'muted',
  'text-[var(--ink-faint)]': 'faint', 'text-[var(--ink-ghost)]': 'ghost', 'text-[var(--accent-600)]': 'accent', 'text-[var(--status-danger)]': 'danger' };
const WEIGHT = { 'font-normal': 'regular', 'font-medium': 'medium', 'font-semibold': 'semibold', 'font-bold': 'bold' };
const LEAD = { 'leading-none': 'none', 'leading-tight': 'tight', 'leading-snug': 'snug', 'leading-normal': 'normal', 'leading-relaxed': 'relaxed' };
// Positioning within the parent: allowed to stay in className.
const PASS = /^(?:(?:sm|md|lg|xl):)?(?:flex-1|flex-none|min-w-0|min-h-0|shrink-0|flex-shrink-0|grow|w-full|h-full|self-(?:start|end|center|stretch)|relative|hidden|block|inline|sm:inline|ml-auto|mr-auto|mx-auto|[mp][trblxy]?-(?:\d+(?:\.\d)?|px|auto)|-?m[trblxy]?-\d+|order-\d|col-span-\d|text-(?:left|center|right)|max-w-(?:xs|sm|md|lg|xl|2xl|prose|none)|whitespace-nowrap|overflow-hidden|break-words|sr-only|group|space-y-\d+(?:\.\d)?)$/;

function plan(classes, tag) {
  const p = { layout: null, props: {}, rest: [], typo: false, unknown: [] };
  for (const c of classes) {
    let m;
    if (c === 'flex' || c === 'inline-flex') { p.layout = p.layout === 'stack' ? 'stack' : 'row'; if (c === 'inline-flex') p.props.inline = true; }
    else if (c === 'flex-col') p.layout = 'stack';
    else if (c === 'flex-row') { }
    else if (c === 'grid') p.layout = 'grid';
    else if (c === 'flex-wrap') p.props.wrap = true;
    else if ((m = c.match(/^items-(start|center|end|baseline|stretch)$/))) p.props.align = m[1];
    else if ((m = c.match(/^justify-(start|center|end|between)$/))) p.props.justify = m[1];
    else if ((m = c.match(/^gap-([\d.]+)$/)) && SPACE.has(m[1])) p.props.gap = m[1];
    else if ((m = c.match(/^gap-x-(\d)$/)) && ['1', '2', '3', '4', '6'].includes(m[1])) p.props.gapX = m[1];
    else if ((m = c.match(/^gap-y-(\d)$/)) && ['1', '2', '3', '4', '6'].includes(m[1])) p.props.gapY = m[1];
    else if ((m = c.match(/^(?:(sm|md|lg):)?grid-cols-([1-4])$/))) { p.cols = p.cols || {}; p.cols[m[1] || 'base'] = m[2]; }
    else if (TXT_SIZE[c]) { p.props.size = TXT_SIZE[c]; p.typo = true; }
    else if (TONE[c]) { p.props.tone = TONE[c]; p.typo = true; }
    else if (WEIGHT[c]) { p.props.weight = WEIGHT[c]; p.typo = true; }
    else if (LEAD[c]) { p.props.leading = LEAD[c]; p.typo = true; }
    else if (c === 'italic') { p.props.italic = true; p.typo = true; }
    else if (c === 'truncate') { p.props.truncate = true; p.typo = true; }
    else if (c === 'tabular-nums') { p.props.numeric = true; p.typo = true; }
    else if (PASS.test(c)) p.rest.push(c);
    else p.unknown.push(c);
  }
  return p;
}

function propString(props) {
  return Object.entries(props).map(([k, v]) =>
    v === true ? k : /^[\d.]+$/.test(v) ? `${k}={${v}}` : `${k}="${v}"`).join(' ');
}

const report = { done: 0, skipped: {} };
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; const used = new Set();
  const TEXT_TAGS = new Set(['p', 'span', 'div', 'label', 'small', 'strong', 'em', 'time', 'dt', 'dd', 'li']);
  const LAYOUT_TAGS = new Set(['div', 'span', 'section', 'ul', 'ol', 'li', 'nav', 'header', 'footer', 'form', 'label']);
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && ts.isIdentifier(opening.tagName) && /^[a-z]/.test(opening.tagName.text)) {
      const tag = opening.tagName.text;
      const attr = opening.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText() === 'className');
      if (attr && attr.initializer && ts.isStringLiteral(attr.initializer)) {
        const classes = attr.initializer.text.split(/\s+/).filter(Boolean);
        const p = plan(classes, tag);
        let comp = null, props = {};
        if (p.unknown.length) { for (const u of p.unknown) report.skipped[u] = (report.skipped[u] || 0) + 1; }
        else if (p.layout && !p.typo && LAYOUT_TAGS.has(tag)) {
          comp = p.layout === 'grid' ? 'Grid' : p.layout === 'stack' ? 'Stack' : 'Row';
          props = { ...p.props };
          if (comp === 'Grid') {
            delete props.align; delete props.justify; delete props.wrap; delete props.inline;
            if (p.cols) props.cols = '{{ ' + Object.entries(p.cols).map(([k, v]) => `${k}: ${v}`).join(', ') + ' }}';
          }
        } else if (!p.layout && p.typo && TEXT_TAGS.has(tag)) { comp = 'Text'; props = { ...p.props }; }
        if (comp) {
          if (tag !== 'div' && comp !== 'Text') props.as = tag;
          if (comp === 'Text' && tag !== 'p') props.as = tag;
          const ps = Object.entries(props).map(([k, v]) => k === 'cols' ? `cols=${v}` : propString({ [k]: v })).join(' ');
          const cls = p.rest.length ? ` className="${p.rest.join(' ')}"` : '';
          edits.push({ start: attr.getStart(sf), end: attr.getEnd(), text: (ps ? ps : '') + cls });
          edits.push({ start: opening.tagName.getStart(sf), end: opening.tagName.getEnd(), text: comp });
          if (ts.isJsxElement(node)) {
            const ct = node.closingElement.tagName;
            edits.push({ start: ct.getStart(sf), end: ct.getEnd(), text: comp });
          }
          used.add(comp); report.done++;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);
  // imports
  const m = src.match(/import \{([^}]*)\} from ['"]@\/components\/ui['"];/);
  if (m) {
    const names = [...new Set([...m[1].split(',').map(s => s.trim()).filter(Boolean), ...used])];
    src = src.replace(m[0], `import { ${names.join(', ')} } from '@/components/ui';`);
  } else {
    const lines = src.split('\n'); let last = 0;
    lines.forEach((l, i) => { if (l.startsWith('import ')) last = i; });
    while (!lines[last].trimEnd().endsWith(';')) last++;
    lines.splice(last + 1, 0, `import { ${[...used].join(', ')} } from '@/components/ui';`);
    src = lines.join('\n');
  }
  if (!dry) fs.writeFileSync(file, src);
  console.log(`${file}: ${edits.length} edits (${[...used].join(', ')})`);
}
console.log('converted', report.done);
console.log('top blocking classes', Object.entries(report.skipped).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}:${v}`).join(' '));
