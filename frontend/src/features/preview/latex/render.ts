/**
 * LaTeX → HTML rendering.
 *
 * Deliberately not a TeX implementation: it covers the article-shaped subset
 * people actually write here — sections, lists, floats, tables, theorems,
 * footnotes, citations and maths — and does so with real numbering and
 * working cross-references, because a preview that renders `\ref{fig:1}` as
 * nothing is worse than no preview.
 *
 * Anything it doesn't know is reported as an issue rather than silently
 * dropped, and unknown commands still render their argument so text never
 * disappears from the page.
 */

import katex from 'katex';
import { lineAt } from '@/features/editor/lib/textOps';
import { escapeHtml } from '@/lib/html';
import {
  readEnvironment, readGroup, readOptional, splitTopLevel, stripComments,
} from './parser';
import { expandMacros, extractPreamble } from './preamble';
import { identitySourceMap, MappedBuilder, originOf, type Mapped, type SourceMap } from './sourceMap';

export interface LatexIssue {
  message: string;
  /** The source fragment that caused it, trimmed for display. */
  source?: string;
}

export interface TocEntry {
  id: string;
  label: string;
  level: number;
  number: string;
}

export interface LatexDocument {
  html: string;
  title: string;
  author: string;
  date: string;
  toc: TocEntry[];
  issues: LatexIssue[];
}

interface MathChunk {
  tex: string;
  display: boolean;
  /** Equation number, when the environment is a numbered one. */
  number?: number;
}

/** Everything that accumulates while walking the document once. */
class Context {
  section = 0;
  subsection = 0;
  subsubsection = 0;
  equation = 0;
  figure = 0;
  table = 0;
  theorem = 0;
  /** Number the next `\label` should bind to. */
  pending = '';
  labels = new Map<string, string>();
  footnotes: string[] = [];
  citations: string[] = [];
  bibliography = new Map<string, string>();
  math: MathChunk[] = [];
  /** Verbatim bodies, lifted out before anything else touches the source. */
  verbatim: string[] = [];
  issues: LatexIssue[] = [];
  toc: TocEntry[] = [];
  /**
   * The document as the writer typed it, and the map from every character of
   * `renderBlocks`'s input back to an offset in it. Set once in `renderLatex`
   * before the walk starts; every block-level render attributes itself
   * through these rather than counting characters of its own transformed
   * input, which is not the writer's document any more.
   */
  originalSource = '';
  sourceMap: SourceMap = identitySourceMap(0);

  /** 1-based line for a global offset into `renderBlocks`'s input — the form
   *  `data-line` is written in, matching `MarkdownPreview`'s convention. */
  lineFor(globalOffset: number): number {
    return lineAt(this.originalSource, originOf(this.sourceMap, globalOffset)).number + 1;
  }

  issue(message: string, source?: string) {
    if (this.issues.length < 40) {
      this.issues.push({ message, source: source?.trim().slice(0, 80) });
    }
  }
}

const MATH_ENVIRONMENTS = [
  'equation', 'align', 'alignat', 'gather', 'multline', 'eqnarray', 'displaymath',
  'flalign', 'split', 'aligned', 'gathered', 'cases', 'array',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix',
];

/** Environments that get an equation number (starred variants never do). */
const NUMBERED_MATH = ['equation', 'align', 'alignat', 'gather', 'multline', 'eqnarray', 'flalign'];

const THEOREM_STYLES: Record<string, string> = {
  theorem: 'Theorem', lemma: 'Lemma', corollary: 'Corollary', proposition: 'Proposition',
  definition: 'Definition', example: 'Example', remark: 'Remark', claim: 'Claim',
  conjecture: 'Conjecture', axiom: 'Axiom', exercise: 'Exercise', problem: 'Problem',
};

const SECTION_LEVELS: Record<string, number> = {
  part: 1, chapter: 1, section: 1, subsection: 2, subsubsection: 3, paragraph: 4, subparagraph: 5,
};

// ═══════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════

export function renderLatex(source: string): LatexDocument {
  const ctx = new Context();
  if (!source.trim()) {
    return { html: '', title: '', author: '', date: '', toc: [], issues: [] };
  }

  /*
   * Five passes stand between this source and the first tag `renderBlocks`
   * emits, and each one changes what a character offset means: verbatim and
   * maths collapse whole spans to a handful of placeholder characters, the
   * preamble reader deletes commands outright, and a macro's expansion is
   * characters that came from its *definition*, not from the line that
   * invoked it. A plain string no longer carries "where did this come from",
   * so every stage below carries a `SourceMap` alongside its text and hands
   * the composed result to `renderBlocks` — see `sourceMap.ts`.
   */
  const verbatimResult = protectVerbatim(source, ctx);
  const strippedResult = stripComments(verbatimResult.text, verbatimResult.map);
  const preamble = extractPreamble(strippedResult.text, strippedResult.map);
  const expandedResult = expandMacros(preamble.body, preamble.macros, preamble.map);
  const mathResult = protectMath(expandedResult.text, ctx, expandedResult.map);

  ctx.originalSource = source;
  ctx.sourceMap = mathResult.map;

  let html = renderBlocks(mathResult.text, ctx, 0);
  html += renderFootnotes(ctx);
  html += renderBibliography(ctx);
  html = resolveReferences(html, ctx);
  html = html.replace('<div class="lx-toc-slot"></div>', renderToc(ctx));

  return {
    html,
    title: preamble.title ? renderInline(preamble.title, ctx) : '',
    author: preamble.author ? renderInline(preamble.author, ctx) : '',
    date: preamble.date ? renderInline(preamble.date, ctx) : '',
    toc: ctx.toc,
    issues: ctx.issues,
  };
}

/**
 * Stamp `data-line` onto an already-rendered block's outermost tag, in the
 * same 1-based-line convention `MarkdownPreview` uses — `PreviewPane`'s click
 * handler reads whichever of the two produced the element it landed on
 * without needing to know which renderer that was.
 *
 * A no-op on empty output (a `\label` or a dropped command renders to
 * nothing) and on anything that isn't a single leading tag, so a stray
 * mismatch here degrades to "this block doesn't jump" rather than corrupting
 * the markup.
 */
function withDataLine(html: string, line: number): string {
  if (!html) return html;
  return html.replace(/^(<[a-zA-Z][a-zA-Z0-9]*)/, `$1 data-line="${line}"`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Maths — pulled out first so no text rule can corrupt it
// ═══════════════════════════════════════════════════════════════════════════

const PLACEHOLDER = '\u0000';

/** `m` for maths, `v` for verbatim — both are opaque to every text rule. */
function placeholder(kind: 'm' | 'v', index: number): string {
  return `${PLACEHOLDER}${kind}${index}${PLACEHOLDER}`;
}

const VERBATIM_ENVIRONMENTS = ['verbatim', 'lstlisting', 'minted', 'alltt'];

/**
 * Lifts verbatim environments out first, so nothing after this point ever
 * sees them — inside one, `%` is not a comment and `$` is not maths.
 *
 * The input here is the writer's actual document, so a kept character's
 * origin is simply its own index; only the placeholder that replaces a whole
 * verbatim block needs to point somewhere else, and it points at the
 * `\begin` that opened it.
 */
function protectVerbatim(src: string, ctx: Context): Mapped {
  const out = new MappedBuilder();
  let i = 0;

  while (i < src.length) {
    const begin = src.startsWith('\\begin{', i)
      ? /^\\begin\{([a-zA-Z]+\*?)\}/.exec(src.slice(i))
      : null;

    if (begin && VERBATIM_ENVIRONMENTS.includes(begin[1].replace(/\*$/, ''))) {
      const env = readEnvironment(src, i);
      if (env) {
        ctx.verbatim.push(env.body.replace(/^\n/, '').replace(/\s+$/, ''));
        out.pushRun(placeholder('v', ctx.verbatim.length - 1), i);
        i = env.end;
        continue;
      }
      ctx.issue(`${begin[0]} is never closed`, begin[0]);
    }

    out.push(src[i], i);
    i++;
  }
  return out.result();
}

function renderPlaceholder(kind: string, index: number, ctx: Context): string {
  if (kind === 'v') {
    const body = ctx.verbatim[index];
    return body === undefined ? '' : `<pre class="lx-pre">${escapeHtml(body)}</pre>`;
  }
  return renderMathChunk(index, ctx);
}

/**
 * Lifts maths out to a placeholder, same idea as `protectVerbatim` — and the
 * same rule for its map: a placeholder has no single source character behind
 * it, so it is attributed to wherever the maths *started*, resolved through
 * `map` since by this point `src` is macro-expanded, not the original text.
 */
function protectMath(src: string, ctx: Context, map: SourceMap): Mapped {
  const out = new MappedBuilder();
  let i = 0;

  const push = (tex: string, display: boolean, numbered: boolean): string => {
    let body = tex;
    const label = /\\label\{([^}]*)\}/.exec(body);
    if (label) body = body.replace(label[0], '');
    const chunk: MathChunk = { tex: body.trim(), display };
    if (numbered) chunk.number = ++ctx.equation;
    if (label && chunk.number) ctx.labels.set(label[1], String(chunk.number));
    ctx.math.push(chunk);
    return placeholder('m', ctx.math.length - 1);
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === '\\') {
      const next = src[i + 1];
      if (next === '[') {
        const close = src.indexOf('\\]', i + 2);
        if (close !== -1) {
          out.pushRun(push(src.slice(i + 2, close), true, false), map[i]);
          i = close + 2;
          continue;
        }
      }
      if (next === '(') {
        const close = src.indexOf('\\)', i + 2);
        if (close !== -1) {
          out.pushRun(push(src.slice(i + 2, close), false, false), map[i]);
          i = close + 2;
          continue;
        }
      }
      const begin = /^\\begin\{([a-zA-Z]+\*?)\}/.exec(src.slice(i));
      if (begin && MATH_ENVIRONMENTS.includes(begin[1].replace(/\*$/, ''))) {
        const env = readEnvironment(src, i);
        if (env) {
          const bare = env.name.replace(/\*$/, '');
          const numbered = NUMBERED_MATH.includes(bare) && !env.name.endsWith('*');
          // Hand KaTeX the whole environment: it understands align, cases,
          // matrices and friends natively, and reproduces their alignment.
          out.pushRun(push(`\\begin{${env.name}}${env.body}\\end{${env.name}}`, true, numbered), map[i]);
          i = env.end;
          continue;
        }
        ctx.issue(`\\begin{${begin[1]}} is never closed`, begin[0]);
      }
      // Escaped character — copy both so `\$` never opens maths.
      out.push(ch, map[i]);
      if (next !== undefined) out.push(next, map[i + 1]);
      i += 2;
      continue;
    }

    if (ch === '$') {
      const display = src[i + 1] === '$';
      const delimiter = display ? '$$' : '$';
      const close = src.indexOf(delimiter, i + delimiter.length);
      if (close === -1) {
        ctx.issue(display ? 'Unclosed $$ … $$' : 'Unclosed $ … $', src.slice(i, i + 40));
        for (let j = i; j < src.length; j++) out.push(src[j], map[j]);
        break;
      }
      out.pushRun(push(src.slice(i + delimiter.length, close), display, false), map[i]);
      i = close + delimiter.length;
      continue;
    }

    out.push(ch, map[i]);
    i++;
  }

  return out.result();
}

function renderMathChunk(index: number, ctx: Context): string {
  const chunk = ctx.math[index];
  if (!chunk) return '';
  let rendered: string;
  try {
    rendered = katex.renderToString(chunk.tex, {
      displayMode: chunk.display,
      throwOnError: true,
      strict: false,
      trust: false,
    });
  } catch (error) {
    ctx.issue(error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/, '') : 'Invalid maths', chunk.tex);
    return `<span class="lx-math-bad" title="${escapeHtml(String(error))}">${escapeHtml(chunk.tex)}</span>`;
  }

  if (!chunk.display) return rendered;
  const number = chunk.number ? `<span class="lx-eq-num">(${chunk.number})</span>` : '';
  return `<div class="lx-eq">${rendered}${number}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Block structure
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_TOKEN = /\\begin\{[^}]+\}|\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{|\\tableofcontents\b|\\bibitem\b/;

/**
 * Walks the top-level structure, calling out to a heading, environment or
 * paragraph renderer for each piece.
 *
 * `base` is where `src` sits in `ctx.sourceMap`'s domain — 0 for the whole
 * document, and the body's own start offset for a nested call (a `quote`, a
 * `proof`, anything that recurses). Every block this finds is wrapped with
 * `data-line`, computed from `base` plus wherever in `src` it began, so a
 * click anywhere in the rendered output — at any nesting depth — can find
 * its way back to the line that produced it.
 */
function renderBlocks(src: string, ctx: Context, base: number): string {
  let out = '';
  let rest = src;
  // The global offset of `rest[0]`. Advanced by exactly what each branch
  // below slices off `rest`, so it always names the right place even as the
  // window this function is looking through shrinks.
  let cursor = base;

  while (rest.length) {
    const scan = new RegExp(BLOCK_TOKEN.source, 'g');
    const hit = scan.exec(rest);
    if (!hit) {
      out += renderParagraphs(rest, ctx, cursor);
      break;
    }

    out += renderParagraphs(rest.slice(0, hit.index), ctx, cursor);
    const token = hit[0];
    const tokenAt = cursor + hit.index;

    if (token.startsWith('\\begin')) {
      const env = readEnvironment(rest, hit.index);
      if (!env) {
        ctx.issue(`${token} is never closed`, token);
        out += renderParagraphs(rest.slice(hit.index + token.length), ctx, cursor + hit.index + token.length);
        break;
      }
      const bodyAt = cursor + env.bodyStart;
      out += withDataLine(renderEnvironment(env.name, env.options, env.body, ctx, bodyAt), ctx.lineFor(tokenAt));
      cursor += env.end;
      rest = rest.slice(env.end);
      continue;
    }

    if (token === '\\tableofcontents') {
      out += withDataLine('<div class="lx-toc-slot"></div>', ctx.lineFor(tokenAt));
      cursor += hit.index + token.length;
      rest = rest.slice(hit.index + token.length);
      continue;
    }

    if (token === '\\bibitem') {
      // A stray \bibitem outside thebibliography — treat the rest as one.
      // Renders to nothing here regardless (the bibliography is composed
      // separately, at the end, from `ctx.bibliography`), so there is no
      // block to attribute a line to.
      out += renderEnvironment('thebibliography', '', rest.slice(hit.index), ctx, cursor + hit.index);
      break;
    }

    // Sectioning command.
    const name = /\\([a-zA-Z]+)\*?/.exec(token)![1];
    const braceAt = hit.index + token.length - 1;
    const group = readGroup(rest, braceAt);
    if (!group) {
      ctx.issue(`\\${name} has no title`, token);
      cursor += braceAt + 1;
      rest = rest.slice(braceAt + 1);
      continue;
    }
    out += withDataLine(renderHeading(name, token.includes('*'), group.body, ctx), ctx.lineFor(tokenAt));
    cursor += group.end;
    rest = rest.slice(group.end);
  }

  return out;
}

/** `base` is `src`'s own offset in `ctx.sourceMap`'s domain — see `renderBlocks`. */
function renderParagraphs(src: string, ctx: Context, base: number): string {
  if (!src.trim()) return '';

  let out = '';
  const boundary = /\n[ \t]*\n+/g;
  let last = 0;
  let match: RegExpExecArray | null;

  const emit = (part: string, partAt: number) => {
    // The trimmed text's own start, not the blank-line-delimited chunk's —
    // a paragraph preceded by two blank lines should point at its first
    // real character, not at the blank line before it.
    const leading = part.length - part.trimStart().length;
    const text = part.trim();
    if (!text) return;
    const line = ctx.lineFor(base + partAt + leading);

    // A display equation or code block stands on its own — wrapping it in
    // <p> would inherit the paragraph's indentation and margins.
    const lone = new RegExp(`^${PLACEHOLDER}([mv])(\\d+)${PLACEHOLDER}$`).exec(text);
    if (lone) {
      out += withDataLine(renderPlaceholder(lone[1], Number(lone[2]), ctx), line);
      return;
    }
    const html = renderInline(text, ctx);
    if (html.trim()) out += withDataLine(`<p class="lx-p">${html}</p>`, line);
  };

  while ((match = boundary.exec(src)) !== null) {
    emit(src.slice(last, match.index), last);
    last = match.index + match[0].length;
  }
  emit(src.slice(last), last);

  return out;
}

function renderHeading(name: string, starred: boolean, title: string, ctx: Context): string {
  const level = SECTION_LEVELS[name] ?? 3;
  let number = '';

  if (!starred && level <= 3) {
    if (level === 1) {
      ctx.section++;
      ctx.subsection = 0;
      ctx.subsubsection = 0;
      number = `${ctx.section}`;
    } else if (level === 2) {
      ctx.subsection++;
      ctx.subsubsection = 0;
      number = `${ctx.section}.${ctx.subsection}`;
    } else {
      ctx.subsubsection++;
      number = `${ctx.section}.${ctx.subsection}.${ctx.subsubsection}`;
    }
    ctx.pending = number;
  }

  const id = `lx-sec-${ctx.toc.length}`;
  const label = renderInline(title, ctx);
  ctx.toc.push({ id, label: stripTags(label), level, number });

  const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : level === 3 ? 'h4' : 'h5';
  const numberSpan = number ? `<span class="lx-num">${number}</span>` : '';
  return `<${tag} id="${id}" class="lx-h lx-h${level}">${numberSpan}${label}</${tag}>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Environments
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `bodyBase` is where `body` sits in `ctx.sourceMap`'s domain — every branch
 * that recurses into `renderBlocks` passes it straight through unchanged,
 * since none of them alter `body` before recursing (the one that does,
 * `renderTableFloat`, carries its own note on the approximation that costs).
 */
function renderEnvironment(name: string, options: string, body: string, ctx: Context, bodyBase: number): string {
  const bare = name.replace(/\*$/, '');

  switch (bare) {
    case 'itemize':
      return `<ul class="lx-list">${listItems(body, ctx, bodyBase)}</ul>`;
    case 'enumerate':
      return `<ol class="lx-list">${listItems(body, ctx, bodyBase)}</ol>`;
    case 'description':
      return `<dl class="lx-desc">${descriptionItems(body, ctx, bodyBase)}</dl>`;

    case 'quote':
    case 'quotation':
      return `<blockquote class="lx-quote">${renderBlocks(body, ctx, bodyBase)}</blockquote>`;
    case 'verse':
      return `<blockquote class="lx-quote lx-verse">${renderBlocks(body, ctx, bodyBase)}</blockquote>`;

    case 'center':
      return `<div class="lx-center">${renderBlocks(body, ctx, bodyBase)}</div>`;
    case 'flushright':
      return `<div class="lx-right">${renderBlocks(body, ctx, bodyBase)}</div>`;
    case 'flushleft':
      return `<div class="lx-left">${renderBlocks(body, ctx, bodyBase)}</div>`;

    case 'abstract':
      return `<section class="lx-abstract"><h3 class="lx-abstract-title">Abstract</h3>${renderBlocks(body, ctx, bodyBase)}</section>`;

    case 'figure':
      return renderFigure(body, ctx);
    case 'table':
      return renderTableFloat(body, ctx, bodyBase);
    case 'tabular':
    case 'tabularx':
    case 'longtable':
      return renderTabular(options, body, ctx);

    case 'thebibliography':
      return collectBibliography(body, ctx);

    case 'proof':
      return `<div class="lx-proof"><span class="lx-proof-title">Proof.</span> ${renderBlocks(body, ctx, bodyBase)}<span class="lx-qed">□</span></div>`;

    case 'document':
      return renderBlocks(body, ctx, bodyBase);

    default:
      if (THEOREM_STYLES[bare]) return renderTheorem(bare, options, body, ctx, bodyBase);
      ctx.issue(`Unsupported environment: ${bare}`, `\\begin{${name}}`);
      return `<div class="lx-unknown-env">${renderBlocks(body, ctx, bodyBase)}</div>`;
  }
}

interface Item {
  option: string;
  content: string;
  /** Offset within `body` where `content` starts — just past `\item[opt]`. */
  contentStart: number;
}

/** Split a list body on top-level `\item`s, leaving nested lists intact. */
function splitItems(body: string): Item[] {
  const items: Item[] = [];
  let depth = 0;
  let current: Item | null = null;
  let buffer = '';
  let i = 0;

  while (i < body.length) {
    if (body[i] === '\\') {
      const begin = /^\\begin\{/.test(body.slice(i));
      const end = /^\\end\{/.test(body.slice(i));
      const item = /^\\item\b/.test(body.slice(i));

      if (begin) depth++;
      if (end) depth--;

      if (item && depth === 0) {
        if (current) {
          current.content = buffer;
          items.push(current);
        }
        buffer = '';
        const cursor = i + 5;
        const optional = readOptional(body, cursor);
        i = optional ? optional.end : cursor;
        current = { option: optional?.body ?? '', content: '', contentStart: i };
        continue;
      }
      buffer += body[i] + (body[i + 1] ?? '');
      i += 2;
      continue;
    }
    buffer += body[i];
    i++;
  }

  if (current) {
    current.content = buffer;
    items.push(current);
  }
  return items;
}

/**
 * Items hold prose most of the time and whole blocks occasionally.
 *
 * `contentBase` is where `content` sits in `ctx.sourceMap`'s domain — the
 * list itself does not get a `data-line` per item (Markdown doesn't either;
 * only the `<ul>`/`<ol>` as a whole is tracked), but a block-level jump from
 * *inside* a multi-paragraph item still needs to land in the right place
 * rather than defaulting to the top of the document.
 */
function renderItemBody(content: string, ctx: Context, contentBase: number): string {
  const needsBlocks = /\\begin\{|\n[ \t]*\n/.test(content);
  return needsBlocks ? renderBlocks(content, ctx, contentBase) : renderInline(content.trim(), ctx);
}

function listItems(body: string, ctx: Context, bodyBase: number): string {
  return splitItems(body)
    .map(item => `<li>${renderItemBody(item.content, ctx, bodyBase + item.contentStart)}</li>`)
    .join('');
}

function descriptionItems(body: string, ctx: Context, bodyBase: number): string {
  return splitItems(body)
    .map(item =>
      `<dt>${renderInline(item.option, ctx)}</dt><dd>${renderItemBody(item.content, ctx, bodyBase + item.contentStart)}</dd>`)
    .join('');
}

function renderFigure(body: string, ctx: Context): string {
  ctx.figure++;
  ctx.pending = String(ctx.figure);

  const image = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/.exec(body);
  const caption = extractCaption(body);
  // Register any \label so \ref resolves to this figure's number.
  renderInline(body.replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, ''), ctx);

  const source = image ? safeUrl(image[1]) : '';
  const img = source
    ? `<img class="lx-img" src="${escapeHtml(source)}" alt="${escapeHtml(stripTags(caption ? renderInline(caption, ctx) : ''))}" loading="lazy" />`
    : `<div class="lx-img-missing">${image ? escapeHtml(image[1]) : 'No image'}</div>`;

  const figcaption = caption
    ? `<figcaption class="lx-caption"><span class="lx-caption-label">Figure ${ctx.figure}.</span> ${renderInline(caption, ctx)}</figcaption>`
    : '';
  return `<figure class="lx-figure">${img}${figcaption}</figure>`;
}

function renderTableFloat(body: string, ctx: Context, bodyBase: number): string {
  ctx.table++;
  ctx.pending = String(ctx.table);

  const caption = extractCaption(body);
  const captionMatch = /\\caption\{[\s\S]*?\}/.exec(body);
  const stripped = captionMatch
    ? body.slice(0, captionMatch.index) + body.slice(captionMatch.index + captionMatch[0].length)
    : body;
  /*
   * Removing the caption shifts every offset after it, which `renderBlocks`
   * has no way to see if it is simply handed `bodyBase` — content past the
   * caption would resolve a few characters short of where it really sits.
   * Captions are essentially always one line, so that shift essentially
   * never crosses a line boundary; a genuinely multi-line `\caption{}` is
   * the one input this can misattribute by however many lines it spanned.
   */
  const inner = renderBlocks(stripped, ctx, bodyBase);
  const figcaption = caption
    ? `<figcaption class="lx-caption"><span class="lx-caption-label">Table ${ctx.table}.</span> ${renderInline(caption, ctx)}</figcaption>`
    : '';
  return `<figure class="lx-figure lx-table-float">${figcaption}${inner}</figure>`;
}

/** `\caption{…}` read with brace matching, so nested groups survive. */
function extractCaption(body: string): string | null {
  const at = body.indexOf('\\caption');
  if (at === -1) return null;
  const braceAt = body.indexOf('{', at);
  if (braceAt === -1) return null;
  return readGroup(body, braceAt)?.body ?? null;
}

const ALIGNMENTS: Record<string, string> = { l: 'left', c: 'center', r: 'right' };

function renderTabular(spec: string, body: string, ctx: Context): string {
  const columns = (spec.match(/[lcr]|p\{[^}]*\}|X/g) ?? []).map(c => ALIGNMENTS[c] ?? 'left');

  const rows = splitTopLevel(body, /\\\\/)
    .map(row => row.replace(/\\(?:hline|toprule|midrule|bottomrule)\s*/g, '').trim())
    .filter(row => row.length > 0);

  if (!rows.length) return '';

  // A rule under the first row means it was a header — the usual convention.
  const hasHeader = /\\(?:hline|toprule|midrule)/.test(body.split(/\\\\/)[1] ?? '');

  const renderRow = (row: string, cell: 'td' | 'th') =>
    `<tr>${splitTopLevel(row, /&/)
      .map((text, i) => {
        const align = columns[i] ?? 'left';
        return `<${cell} class="lx-cell" style="text-align:${align}">${renderInline(text.trim(), ctx)}</${cell}>`;
      })
      .join('')}</tr>`;

  const head = hasHeader ? `<thead>${renderRow(rows[0], 'th')}</thead>` : '';
  const bodyRows = (hasHeader ? rows.slice(1) : rows).map(row => renderRow(row, 'td')).join('');
  return `<div class="lx-table-wrap"><table class="lx-table">${head}<tbody>${bodyRows}</tbody></table></div>`;
}

function renderTheorem(kind: string, note: string, body: string, ctx: Context, bodyBase: number): string {
  ctx.theorem++;
  ctx.pending = String(ctx.theorem);
  const title = THEOREM_STYLES[kind];
  const suffix = note ? ` <span class="lx-thm-note">(${renderInline(note, ctx)})</span>` : '';
  return (
    `<div class="lx-theorem" data-kind="${kind}">` +
    `<div class="lx-thm-head">${title} ${ctx.theorem}.${suffix}</div>` +
    `<div class="lx-thm-body">${renderBlocks(body, ctx, bodyBase)}</div></div>`
  );
}

function collectBibliography(body: string, ctx: Context): string {
  const entries = body.split(/\\bibitem/).slice(1);
  for (const entry of entries) {
    const key = readGroup(entry, entry.indexOf('{'));
    if (!key) continue;
    ctx.bibliography.set(key.body.trim(), entry.slice(key.end).trim());
  }
  // Rendered at the end alongside citations, in citation order.
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════
// Inline rendering
// ═══════════════════════════════════════════════════════════════════════════

type Handler = (args: string[], ctx: Context) => string;

interface CommandSpec {
  args: number;
  optional?: boolean;
  render: Handler;
}

function wrapTag(tag: string, className = ''): CommandSpec {
  const cls = className ? ` class="${className}"` : '';
  return { args: 1, render: (args, ctx) => `<${tag}${cls}>${renderInline(args[0], ctx)}</${tag}>` };
}

const COMMANDS: Record<string, CommandSpec> = {
  textbf: wrapTag('strong'),
  bf: wrapTag('strong'),
  textit: wrapTag('em'),
  emph: wrapTag('em'),
  it: wrapTag('em'),
  underline: wrapTag('u'),
  uline: wrapTag('u'),
  sout: wrapTag('s'),
  texttt: wrapTag('code', 'lx-code'),
  textsc: wrapTag('span', 'lx-sc'),
  textsf: wrapTag('span', 'lx-sf'),
  textrm: wrapTag('span'),
  textnormal: wrapTag('span'),
  textsuperscript: wrapTag('sup'),
  textsubscript: wrapTag('sub'),
  mbox: wrapTag('span'),
  text: wrapTag('span'),

  textcolor: {
    args: 2,
    render: (args, ctx) => {
      const colour = /^[#\w]+$/.test(args[0].trim()) ? args[0].trim() : 'inherit';
      return `<span style="color:${colour}">${renderInline(args[1], ctx)}</span>`;
    },
  },

  href: {
    args: 2,
    render: (args, ctx) => {
      const url = safeUrl(args[0]);
      const label = renderInline(args[1], ctx);
      return url ? `<a class="lx-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    },
  },
  url: {
    args: 1,
    render: args => {
      const url = safeUrl(args[0]);
      return url ? `<a class="lx-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(args[0])}</a>` : escapeHtml(args[0]);
    },
  },

  footnote: {
    args: 1,
    render: (args, ctx) => {
      ctx.footnotes.push(renderInline(args[0], ctx));
      const n = ctx.footnotes.length;
      return `<sup class="lx-fn-mark"><a href="#lx-fn-${n}" id="lx-fnref-${n}">${n}</a></sup>`;
    },
  },

  label: {
    args: 1,
    render: (args, ctx) => {
      if (ctx.pending) ctx.labels.set(args[0].trim(), ctx.pending);
      return '';
    },
  },
  ref: { args: 1, render: args => referenceMark(args[0], false) },
  eqref: { args: 1, render: args => referenceMark(args[0], true) },
  pageref: { args: 1, render: args => referenceMark(args[0], false) },

  cite: { args: 1, render: (args, ctx) => citationMark(args[0], ctx) },
  citep: { args: 1, render: (args, ctx) => citationMark(args[0], ctx) },
  citet: { args: 1, render: (args, ctx) => citationMark(args[0], ctx) },

  includegraphics: {
    args: 1,
    optional: true,
    render: args => {
      const url = safeUrl(args[args.length - 1]);
      return url ? `<img class="lx-img" src="${escapeHtml(url)}" alt="" loading="lazy" />` : '';
    },
  },
  caption: { args: 1, render: (args, ctx) => `<span class="lx-caption">${renderInline(args[0], ctx)}</span>` },
  item: { args: 0, render: () => '<br/>• ' },
};

/** Commands that produce a fixed bit of text. */
const LITERALS: Record<string, string> = {
  ldots: '…', dots: '…', textellipsis: '…',
  textbackslash: '\\', textasciitilde: '~', textasciicircum: '^',
  LaTeX: 'L<sup class="lx-logo-a">A</sup>T<sub class="lx-logo-e">E</sub>X',
  TeX: 'T<sub class="lx-logo-e">E</sub>X',
  today: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
  quad: '&nbsp;&nbsp;&nbsp;&nbsp;', qquad: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;',
  newline: '<br/>', hrule: '<hr class="lx-hr" />', hfill: ' ',
  bigskip: '<div class="lx-skip"></div>', medskip: '<div class="lx-skip"></div>', smallskip: '',
  copyright: '©', pounds: '£', dag: '†', ddag: '‡', S: '§', P: '¶',
};

/** Characters that are escapes rather than commands. */
const ESCAPES: Record<string, string> = {
  '&': '&amp;', '%': '%', $: '$', '#': '#', _: '_', '{': '{', '}': '}',
  ' ': ' ', ',': '&thinsp;', ';': '&nbsp;', '!': '', '-': '',
};

const COMMANDS_IGNORED = new Set([
  'centering', 'noindent', 'par', 'hline', 'toprule', 'midrule', 'bottomrule',
  'vfill', 'clearpage', 'newpage', 'pagebreak', 'linebreak', 'protect',
  'small', 'footnotesize', 'normalsize', 'large', 'Large', 'LARGE', 'huge', 'Huge',
  'rmfamily', 'sffamily', 'ttfamily', 'bfseries', 'itshape', 'upshape', 'normalfont',
  'maketitle', 'tableofcontents', 'listoffigures', 'listoftables', 'appendix',
]);

function renderInline(src: string, ctx: Context): string {
  let out = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Protected maths or verbatim.
    if (ch === PLACEHOLDER) {
      const close = src.indexOf(PLACEHOLDER, i + 1);
      if (close === -1) break;
      out += renderPlaceholder(src[i + 1], Number(src.slice(i + 2, close)), ctx);
      i = close + 1;
      continue;
    }

    if (ch === '\\') {
      const next = src[i + 1] ?? '';

      if (next === '\\') {
        out += '<br/>';
        i += 2;
        // A `\\` may carry an optional spacing argument: \\[2ex]
        const spacing = readOptional(src, i);
        if (spacing) i = spacing.end;
        continue;
      }

      const named = /^\\([a-zA-Z@]+\*?)/.exec(src.slice(i));
      if (!named) {
        out += ESCAPES[next] ?? escapeHtml(next);
        i += 2;
        continue;
      }

      const name = named[1].replace(/\*$/, '');
      let cursor = i + named[0].length;

      if (name === 'verb') {
        const delimiter = src[cursor];
        const close = src.indexOf(delimiter, cursor + 1);
        if (close !== -1) {
          out += `<code class="lx-code">${escapeHtml(src.slice(cursor + 1, close))}</code>`;
          i = close + 1;
          continue;
        }
      }

      const spec = COMMANDS[name];
      if (spec) {
        const args: string[] = [];
        if (spec.optional) {
          const optional = readOptional(src, cursor);
          if (optional) cursor = optional.end;
        }
        while (args.length < spec.args) {
          const group = readGroup(src, skipWhitespace(src, cursor));
          if (!group) break;
          args.push(group.body);
          cursor = group.end;
        }
        if (args.length === spec.args) {
          out += spec.render(args, ctx);
          i = cursor;
          continue;
        }
      }

      if (LITERALS[name] !== undefined) {
        out += LITERALS[name];
        i = cursor;
        continue;
      }

      if (COMMANDS_IGNORED.has(name)) {
        i = cursor;
        continue;
      }

      // Unknown command: keep its argument. Losing the text would be worse
      // than losing the styling, and the issue list says what was skipped.
      const group = readGroup(src, skipWhitespace(src, cursor));
      ctx.issue(`Unsupported command: \\${name}`, named[0]);
      if (group) {
        out += renderInline(group.body, ctx);
        i = group.end;
      } else {
        i = cursor;
      }
      continue;
    }

    if (ch === '{') {
      const group = readGroup(src, i);
      if (group) {
        out += renderInline(group.body, ctx);
        i = group.end;
        continue;
      }
    }
    if (ch === '}') {
      i++;
      continue;
    }

    // Text-mode typography.
    if (ch === '-' && src.startsWith('---', i)) { out += '—'; i += 3; continue; }
    if (ch === '-' && src.startsWith('--', i)) { out += '–'; i += 2; continue; }
    if (ch === '`' && src[i + 1] === '`') { out += '“'; i += 2; continue; }
    if (ch === "'" && src[i + 1] === "'") { out += '”'; i += 2; continue; }
    if (ch === '`') { out += '‘'; i++; continue; }
    if (ch === '~') { out += '&nbsp;'; i++; continue; }
    if (ch === '\n') { out += '\n'; i++; continue; }

    out += escapeHtml(ch);
    i++;
  }

  return out;
}

function skipWhitespace(src: string, at: number): number {
  let i = at;
  while (i < src.length && (src[i] === ' ' || src[i] === '\n' || src[i] === '\t')) i++;
  return i;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cross-references, footnotes, bibliography
// ═══════════════════════════════════════════════════════════════════════════

function referenceMark(key: string, parenthesised: boolean): string {
  return `<a class="lx-ref" href="#" data-ref="${escapeHtml(key.trim())}" data-paren="${parenthesised}">?</a>`;
}

function citationMark(keys: string, ctx: Context): string {
  const numbers = keys.split(',').map(raw => {
    const key = raw.trim();
    let index = ctx.citations.indexOf(key);
    if (index === -1) {
      ctx.citations.push(key);
      index = ctx.citations.length - 1;
    }
    return `<a class="lx-cite" href="#lx-bib-${index + 1}">${index + 1}</a>`;
  });
  return `[${numbers.join(', ')}]`;
}

/**
 * Fill in `\ref` targets once every number is known — forward references are
 * normal in a document, so this cannot happen during the walk.
 */
function resolveReferences(html: string, ctx: Context): string {
  return html.replace(
    /<a class="lx-ref" href="#" data-ref="([^"]*)" data-paren="(true|false)">\?<\/a>/g,
    (_, key: string, paren: string) => {
      const number = ctx.labels.get(key);
      if (!number) {
        ctx.issue(`Reference to an unknown label: ${key}`);
        return '<span class="lx-ref lx-ref-missing" title="No matching \\label">??</span>';
      }
      const text = paren === 'true' ? `(${number})` : number;
      return `<span class="lx-ref">${text}</span>`;
    },
  );
}

/** `\tableofcontents` is filled in after the walk, once every number exists. */
function renderToc(ctx: Context): string {
  if (!ctx.toc.length) return '';
  const items = ctx.toc
    .map(entry =>
      `<li class="lx-toc-item" data-level="${entry.level}">` +
      `<a href="#${entry.id}">${entry.number ? `<span class="lx-num">${entry.number}</span>` : ''}` +
      `${escapeHtml(entry.label)}</a></li>`)
    .join('');
  return `<nav class="lx-toc"><div class="lx-toc-title">Contents</div><ul>${items}</ul></nav>`;
}

function renderFootnotes(ctx: Context): string {
  if (!ctx.footnotes.length) return '';
  const items = ctx.footnotes
    .map((note, i) =>
      `<li id="lx-fn-${i + 1}"><a class="lx-fn-back" href="#lx-fnref-${i + 1}">↑</a> ${note}</li>`)
    .join('');
  return `<section class="lx-footnotes"><ol>${items}</ol></section>`;
}

function renderBibliography(ctx: Context): string {
  if (!ctx.citations.length && !ctx.bibliography.size) return '';
  const keys = ctx.citations.length ? ctx.citations : [...ctx.bibliography.keys()];
  const items = keys
    .map((key, i) => {
      const entry = ctx.bibliography.get(key);
      if (!entry) ctx.issue(`Citation with no bibliography entry: ${key}`);
      return `<li id="lx-bib-${i + 1}"><span class="lx-bib-num">[${i + 1}]</span> ${
        entry ? renderInline(entry, ctx) : `<span class="lx-ref-missing">${escapeHtml(key)}</span>`
      }</li>`;
    })
    .join('');
  return `<section class="lx-bibliography"><h3 class="lx-h lx-h1">References</h3><ul>${items}</ul></section>`;
}

// ═══════════════════════════════════════════════════════════════════════════

/** Only allow URLs that can't execute script. */
function safeUrl(raw: string): string {
  const url = raw.trim();
  if (/^(https?:|mailto:|\/|#|\.\/|data:image\/)/i.test(url)) return url;
  if (/^[\w./-]+\.(png|jpe?g|gif|svg|webp|pdf)$/i.test(url)) return url;
  return '';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
