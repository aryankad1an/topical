/**
 * Pure text transformations for the editor.
 *
 * Every one takes a document plus a selection and returns the next document
 * plus where the selection should land. Keeping them free of React and of the
 * DOM means the toolbar, the keyboard shortcuts and the slash menu can all
 * drive the same operation instead of each re-implementing string surgery.
 */

import type { DocFormat } from '@/lib/types';

export interface Range {
  start: number;
  end: number;
}

export interface EditResult extends Range {
  content: string;
}

export interface Line {
  /** Offset of the first character of the line. */
  start: number;
  /** Offset just past the last character (before the newline). */
  end: number;
  text: string;
  /** Zero-based line number. */
  number: number;
}

// ── Line geometry ─────────────────────────────────────────────────────────

export function lineAt(doc: string, index: number): Line {
  const at = clamp(index, 0, doc.length);
  const start = doc.lastIndexOf('\n', at - 1) + 1;
  const nl = doc.indexOf('\n', at);
  const end = nl === -1 ? doc.length : nl;
  return { start, end, text: doc.slice(start, end), number: countLines(doc, start) };
}

/** Every line touched by a selection, in document order. */
function linesIn(doc: string, sel: Range): Line[] {
  const first = lineAt(doc, sel.start);
  const lines: Line[] = [first];
  let cursor = first.end;
  while (cursor < sel.end) {
    const next = lineAt(doc, cursor + 1);
    lines.push(next);
    if (next.end <= cursor) break;
    cursor = next.end;
  }
  return lines;
}

function countLines(doc: string, upTo: number): number {
  let n = 0;
  for (let i = 0; i < upTo && i < doc.length; i++) if (doc[i] === '\n') n++;
  return n;
}

/** Offset of the start of a zero-based line number. */
export function offsetOfLine(doc: string, line: number): number {
  let offset = 0;
  for (let i = 0; i < line; i++) {
    const nl = doc.indexOf('\n', offset);
    if (nl === -1) return doc.length;
    offset = nl + 1;
  }
  return offset;
}

/** 1-based line and column for a caret offset — for the status bar. */
export function caretPosition(doc: string, index: number): { line: number; column: number } {
  const line = lineAt(doc, index);
  return { line: line.number + 1, column: index - line.start + 1 };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(n, hi));
}

// ── Inline wrapping ───────────────────────────────────────────────────────

/**
 * Wrap the selection in `before`/`after`, or unwrap it when the markers are
 * already there — so the same ⌘B both bolds and unbolds.
 */
export function toggleWrap(
  doc: string,
  sel: Range,
  before: string,
  after: string,
  placeholder = '',
): EditResult {
  const selected = doc.slice(sel.start, sel.end);

  // Already wrapped inside the selection: **like this**
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      content: doc.slice(0, sel.start) + inner + doc.slice(sel.end),
      start: sel.start,
      end: sel.start + inner.length,
    };
  }

  // Wrapped just outside the selection: **|like this|**
  const outerStart = sel.start - before.length;
  if (
    outerStart >= 0 &&
    doc.slice(outerStart, sel.start) === before &&
    doc.slice(sel.end, sel.end + after.length) === after
  ) {
    return {
      content: doc.slice(0, outerStart) + selected + doc.slice(sel.end + after.length),
      start: outerStart,
      end: outerStart + selected.length,
    };
  }

  // With nothing selected, the placeholder goes in selected — so it can be
  // typed straight over.
  const body = selected || placeholder;
  const at = sel.start + before.length;
  return {
    content: doc.slice(0, sel.start) + before + body + after + doc.slice(sel.end),
    start: at,
    end: at + body.length,
  };
}

// ── Line prefixes (headings, quotes, lists) ───────────────────────────────

/**
 * Add `prefix` to every selected line, or strip it when all of them already
 * have it. Heading levels replace each other rather than stacking.
 */
export function toggleLinePrefix(doc: string, sel: Range, prefix: string): EditResult {
  const lines = linesIn(doc, sel);
  const family = prefixFamily(prefix);
  const allHave = lines.every(l => l.text.startsWith(prefix));

  let out = '';
  let cursor = 0;
  let delta = 0;
  let firstDelta = 0;

  for (const line of lines) {
    out += doc.slice(cursor, line.start);
    const stripped = family ? line.text.replace(family, '') : line.text;
    const next = allHave ? stripped : prefix + stripped;
    const change = next.length - line.text.length;
    if (cursor <= sel.start) firstDelta = change;
    delta += change;
    out += next;
    cursor = line.end;
  }
  out += doc.slice(cursor);

  return { content: out, start: Math.max(0, sel.start + firstDelta), end: Math.max(0, sel.end + delta) };
}

/** Regex for the markers a prefix should replace (so `##` supersedes `#`). */
function prefixFamily(prefix: string): RegExp | null {
  if (/^#+ $/.test(prefix)) return /^#{1,6} /;
  if (prefix === '> ') return /^> /;
  if (prefix === '- ') return /^(?:[-*+] |\d+[.)] )/;
  if (/^\d+\. $/.test(prefix)) return /^(?:[-*+] |\d+[.)] )/;
  return null;
}

// ── Indentation ───────────────────────────────────────────────────────────

export function indentLines(doc: string, sel: Range, unit = '  '): EditResult {
  const lines = linesIn(doc, sel);
  let out = '';
  let cursor = 0;
  for (const line of lines) {
    out += doc.slice(cursor, line.start) + unit + line.text;
    cursor = line.end;
  }
  out += doc.slice(cursor);
  return { content: out, start: sel.start + unit.length, end: sel.end + unit.length * lines.length };
}

export function outdentLines(doc: string, sel: Range, unit = '  '): EditResult {
  const lines = linesIn(doc, sel);
  let out = '';
  let cursor = 0;
  let delta = 0;
  let firstDelta = 0;
  for (const line of lines) {
    const removed = line.text.startsWith(unit)
      ? unit.length
      : line.text.startsWith('\t')
        ? 1
        : Math.min(line.text.length - line.text.trimStart().length, unit.length);
    out += doc.slice(cursor, line.start) + line.text.slice(removed);
    if (cursor <= sel.start) firstDelta = removed;
    delta += removed;
    cursor = line.end;
  }
  out += doc.slice(cursor);
  return { content: out, start: Math.max(0, sel.start - firstDelta), end: Math.max(0, sel.end - delta) };
}

// ── Enter: keep lists and environments going ──────────────────────────────

const MD_ITEM = /^(\s*)(?:([-*+])|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/;
const TEX_ITEM = /^(\s*)\\item(\s+)/;

/**
 * What pressing Enter should insert, or null to let the browser do its thing.
 *
 * Continues bullets, numbered lists (incrementing), task lists, blockquotes
 * and `\item`s; on an empty item it clears the marker instead, which is how
 * every editor people already use ends a list.
 */
export function continueBlock(doc: string, caret: number, format: DocFormat): EditResult | null {
  const line = lineAt(doc, caret);
  // Only continue when the caret sits at the end of the line's content.
  if (caret < line.end) return null;

  if (format === 'latex') {
    const item = TEX_ITEM.exec(line.text);
    if (item) {
      const [match, indent, gap] = item;
      const body = line.text.slice(match.length);
      if (!body.trim()) return replaceLine(doc, line, indent, caret);
      return insert(doc, caret, `\n${indent}\\item${gap}`);
    }
    const begin = /^\s*\\begin\{([^}]+)\}/.exec(line.text);
    if (begin && !doc.slice(caret).includes(`\\end{${begin[1]}}`)) {
      const indent = /^\s*/.exec(line.text)?.[0] ?? '';
      const inner = `\n${indent}  `;
      const closing = `\n${indent}\\end{${begin[1]}}`;
      return {
        content: doc.slice(0, caret) + inner + closing + doc.slice(caret),
        start: caret + inner.length,
        end: caret + inner.length,
      };
    }
    return null;
  }

  const quote = /^(\s*)> ?/.exec(line.text);
  if (quote && line.text.slice(quote[0].length).trim()) {
    return insert(doc, caret, `\n${quote[0]}`);
  }

  const item = MD_ITEM.exec(line.text);
  if (!item) return null;
  const [match, indent, bullet, num, delim, gap, task] = item;
  const body = line.text.slice(match.length);
  if (!body.trim()) return replaceLine(doc, line, indent, caret);

  const marker = bullet ? bullet : `${Number(num) + 1}${delim}`;
  const box = task ? '[ ] ' : '';
  return insert(doc, caret, `\n${indent}${marker}${gap}${box}`);
}

function insert(doc: string, at: number, text: string): EditResult {
  return {
    content: doc.slice(0, at) + text + doc.slice(at),
    start: at + text.length,
    end: at + text.length,
  };
}

/** Empty list item + Enter — drop the marker and leave a blank line. */
function replaceLine(doc: string, line: Line, indent: string, caret: number): EditResult {
  const content = doc.slice(0, line.start) + indent + doc.slice(caret);
  const at = line.start + indent.length;
  return { content, start: at, end: at };
}

// ── Auto-pairing ──────────────────────────────────────────────────────────

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  '`': '`',
  $: '$',
};

/**
 * Typing a bracket with text selected wraps it; typing one with an empty
 * caret inserts the pair. Returns null when the character should be typed
 * normally.
 */
export function autoPair(doc: string, sel: Range, char: string): EditResult | null {
  const close = PAIRS[char];
  if (!close) return null;
  if (sel.end > sel.start) {
    const body = doc.slice(sel.start, sel.end);
    return {
      content: doc.slice(0, sel.start) + char + body + close + doc.slice(sel.end),
      start: sel.start + 1,
      end: sel.start + 1 + body.length,
    };
  }
  // Don't pair mid-word — `don't` and `x` shouldn't sprout closers.
  const next = doc[sel.start] ?? '';
  if (next && /[\w$]/.test(next)) return null;
  return {
    content: doc.slice(0, sel.start) + char + close + doc.slice(sel.start),
    start: sel.start + 1,
    end: sel.start + 1,
  };
}

/** Typing the closing half of a pair right before it just moves past it. */
export function skipClosing(doc: string, sel: Range, char: string): boolean {
  if (sel.end !== sel.start) return false;
  return Object.values(PAIRS).includes(char) && doc[sel.start] === char;
}

// ── Block placement ───────────────────────────────────────────────────────

/**
 * Insert `text` at `pos`, adding `separator` only on the sides that actually
 * border existing content.
 *
 * Handles the four cases an append-only version gets wrong: an empty document
 * (no separators), appending at the end (leading only), inserting at the very
 * start (trailing only), and inserting mid-document (both, so the insertion
 * doesn't fuse onto the surrounding paragraphs).
 */
export function insertBlock(doc: string, text: string, pos: number, separator: string): EditResult {
  const at = clamp(pos, 0, doc.length);
  // Drop whitespace bordering the insertion point: the separator defines the
  // gap on its own, so leaving it would compound.
  const before = doc.slice(0, at).replace(/\s+$/, '');
  const after = doc.slice(at).replace(/^\s+/, '');

  const head = before + (before ? separator : '') + text;
  return { content: head + (after ? separator : '') + after, start: head.length, end: head.length };
}

/** The block separator for a format. LaTeX has no `---` rule. */
export function separatorFor(format: DocFormat): string {
  return format === 'latex' ? '\n\n' : '\n\n---\n\n';
}

/**
 * Character offset within a textarea corresponding to a viewport point.
 *
 * Needed because a drop handler that calls `preventDefault()` suppresses the
 * browser's native caret-follows-drag behaviour, leaving `selectionStart` at
 * wherever the caret was *before* the drag — so dropped text landed in the
 * wrong place. Falls back to the current caret when the platform offers
 * neither caret API.
 */
export function caretIndexFromPoint(textarea: HTMLTextAreaElement, x: number, y: number): number {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y);
    if (position && textarea.contains(position.offsetNode)) return position.offset;
    // Firefox reports the textarea itself as the offsetNode.
    if (position && position.offsetNode === textarea) return position.offset;
  }

  if (typeof document.caretRangeFromPoint === 'function') {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return range.startOffset;
  }

  return textarea.selectionStart;
}
