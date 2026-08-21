/**
 * Markup-aware syntax highlighting for the editing surface.
 *
 * The editor is a real `<textarea>` (so native undo, spellcheck, IME and
 * accessibility keep working) drawn on top of a `<pre>` that renders the same
 * text in colour. That only holds together if highlighting preserves every
 * character exactly — so this produces a flat, non-overlapping list of token
 * ranges and emits them verbatim, never rewriting the source.
 */

import type { DocFormat } from '@/lib/types';
import type { Range } from './textOps';

export type TokenKind =
  | 'head' | 'strong' | 'em' | 'del' | 'code' | 'math' | 'link' | 'url'
  | 'quote' | 'marker' | 'rule' | 'tag' | 'cmd' | 'env' | 'comment' | 'punct'
  | 'find' | 'find-active';

interface Token extends Range {
  kind: TokenKind;
}

/** Documents past this size skip colouring — the overlay would cost more than it gives. */
const MAX_HIGHLIGHT_CHARS = 120_000;

export function highlight(text: string, format: DocFormat, finds: Range[] = [], activeFind = -1): string {
  if (text.length > MAX_HIGHLIGHT_CHARS) {
    return text.split('\n').map(l => `<div class="cl">${escapeHtml(l) || '<br/>'}</div>`).join('');
  }

  const tokens: Token[] = [];
  // Find matches win every overlap: while searching, matches are what the eye
  // is hunting for, and losing italics inside one for a moment costs nothing.
  finds.forEach((f, i) => tokens.push({ ...f, kind: i === activeFind ? 'find-active' : 'find' }));

  (format === 'latex' ? scanLatex : scanMarkdown)(text, tokens);
  return emit(text, resolve(tokens));
}

// ── Scanners ──────────────────────────────────────────────────────────────

/** Each entry is scanned in order; earlier patterns win any overlap. */
const MARKDOWN_RULES: [RegExp, TokenKind][] = [
  [/^```[\s\S]*?(?:^```|$(?![\s\S]))/gm, 'code'],
  [/^ {0,3}#{1,6} .*$/gm, 'head'],
  [/^ {0,3}(?:---|\*\*\*|___)[ \t]*$/gm, 'rule'],
  [/^[ \t]*>[ \t]?.*$/gm, 'quote'],
  [/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, 'marker'],
  [/^[ \t]*\|.*\|[ \t]*$/gm, 'punct'],
  [/\$\$[\s\S]*?\$\$/g, 'math'],
  [/(?<![\\$])\$(?!\s)[^$\n]*?(?<!\s)\$(?!\d)/g, 'math'],
  [/`[^`\n]+`/g, 'code'],
  [/!?\[[^\]\n]*\]/g, 'link'],
  [/\((?:https?:\/\/|\/|#|\.)[^)\s]*\)/g, 'url'],
  [/(\*\*|__)(?=\S)[\s\S]*?\S\1/g, 'strong'],
  [/(?<![*\w])\*(?=\S)[^*\n]*?\S\*(?!\*)/g, 'em'],
  [/(?<![_\w])_(?=\S)[^_\n]*?\S_(?!_)/g, 'em'],
  [/~~[\s\S]*?~~/g, 'del'],
  [/<\/?[A-Za-z][^>\n]*>/g, 'tag'],
];

function scanMarkdown(text: string, out: Token[]) {
  collect(text, MARKDOWN_RULES, out);
}

const LATEX_RULES: [RegExp, TokenKind][] = [
  [/(?<!\\)%[^\n]*/g, 'comment'],
  [/\\begin\{(verbatim|lstlisting|minted)\}[\s\S]*?\\end\{\1\}/g, 'code'],
  [/\\begin\{(equation|align|gather|multline|eqnarray|displaymath)\*?\}[\s\S]*?\\end\{\1\*?\}/g, 'math'],
  [/\$\$[\s\S]*?\$\$/g, 'math'],
  [/\\\[[\s\S]*?\\\]/g, 'math'],
  [/(?<!\\)\$(?!\s)[^$\n]*?\$/g, 'math'],
  [/\\\((?:[\s\S]*?)\\\)/g, 'math'],
  [/\\(?:begin|end)\{[^}\n]*\}/g, 'env'],
  [/\\(?:[A-Za-z@]+\*?|[^A-Za-z\s])/g, 'cmd'],
  [/[{}]/g, 'punct'],
  [/[&#^_~]/g, 'punct'],
];

function scanLatex(text: string, out: Token[]) {
  collect(text, LATEX_RULES, out);
}

function collect(text: string, rules: [RegExp, TokenKind][], out: Token[]) {
  for (const [pattern, kind] of rules) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      out.push({ start: match.index, end: match.index + match[0].length, kind });
    }
  }
}

// ── Flattening ────────────────────────────────────────────────────────────

/** Sort by position, then drop anything that overlaps an already-kept token. */
function resolve(tokens: Token[]): Token[] {
  const ordered = tokens
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.start - b.t.start || a.i - b.i)
    .map(x => x.t);

  const kept: Token[] = [];
  let boundary = 0;
  for (const token of ordered) {
    if (token.start < boundary) continue;
    kept.push(token);
    boundary = token.end;
  }
  return kept;
}

/**
 * Emit one `<div>` per source line.
 *
 * Lines have to be real elements for two reasons: the gutter numbers come
 * from a CSS counter on them, and focus mode dims every line but the caret's.
 * Tokens are therefore split at newlines — a fenced code block becomes one
 * span per line, which looks identical and keeps the structure flat.
 */
function emit(text: string, tokens: Token[]): string {
  const lines: string[] = [];
  let current = '';
  let cursor = 0;

  const pushText = (s: string, kind?: TokenKind) => {
    const parts = s.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push(current);
        current = '';
      }
      if (part) {
        current += kind
          ? `<span class="tok tok-${kind}">${escapeHtml(part)}</span>`
          : escapeHtml(part);
      }
    });
  };

  for (const token of tokens) {
    if (token.start > cursor) pushText(text.slice(cursor, token.start));
    pushText(text.slice(token.start, token.end), token.kind);
    cursor = token.end;
  }
  pushText(text.slice(cursor));
  lines.push(current);

  // Exactly one element per source line — no padding element. The mirror and
  // the textarea share their bottom padding, so heights already match, and an
  // extra element here would number a line that does not exist.
  return lines.map(line => `<div class="cl">${line || '<br/>'}</div>`).join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
