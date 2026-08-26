/**
 * Low-level LaTeX scanning.
 *
 * The previous renderer was a stack of `String.replace` calls, which meant
 * `\textbf{a {b} c}` lost its tail, math got mangled by the text rules that
 * ran after it, and a missing `\end{}` silently ate the rest of the document.
 * These helpers do the one thing regex cannot: match braces.
 */

import { MappedBuilder, type Mapped, type SourceMap } from './sourceMap';

export interface Group {
  /** Contents between the delimiters, exclusive. */
  body: string;
  /** Index just past the closing delimiter. */
  end: number;
}

/**
 * Remove `%` comments. A comment runs to end of line and also swallows the
 * newline plus the next line's indentation, which is what TeX itself does —
 * otherwise commented-out lines leave stray blank lines that split paragraphs.
 *
 * Carries `map` alongside `src` (see `sourceMap.ts`) and produces the same
 * shape back: a comment's characters simply have nothing pushed for them,
 * which is correct — a line that renders nothing has nowhere for a click to
 * jump to.
 */
export function stripComments(src: string, map: SourceMap): Mapped {
  const out = new MappedBuilder();
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      out.push(ch, map[i]);
      if (src[i + 1] !== undefined) out.push(src[i + 1], map[i + 1]);
      i++;
      continue;
    }
    if (ch === '%') {
      const nl = src.indexOf('\n', i);
      if (nl === -1) return out.result();
      i = nl;
      while (src[i + 1] === ' ' || src[i + 1] === '\t') i++;
      continue;
    }
    out.push(ch, map[i]);
  }
  return out.result();
}

/** Read a `{…}` group starting at `at`, honouring nesting and escapes. */
export function readGroup(src: string, at: number): Group | null {
  return readDelimited(src, at, '{', '}');
}

/** Read an `[…]` optional argument starting at `at`. */
export function readOptional(src: string, at: number): Group | null {
  return readDelimited(src, at, '[', ']');
}

function readDelimited(src: string, at: number, open: string, close: string): Group | null {
  if (src[at] !== open) return null;
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { body: src.slice(at + 1, i), end: i + 1 };
    }
  }
  return null;
}

export interface Environment {
  name: string;
  /** The `[…]` argument on `\begin`, if present (e.g. `[h]` on a figure). */
  options: string;
  body: string;
  /** Index of the `\begin`. */
  start: number;
  /** Index just past the `\end{…}`. */
  end: number;
  /** Index where `body` begins — just past `\begin{name}[options]`. */
  bodyStart: number;
}

/**
 * Match the environment whose `\begin` sits at `at`, pairing it with the
 * matching `\end` across any nested environments of the same name.
 */
export function readEnvironment(src: string, at: number): Environment | null {
  const begin = /^\\begin\{([^}]+)\}/.exec(src.slice(at));
  if (!begin) return null;
  const name = begin[1];

  let cursor = at + begin[0].length;
  const optional = readOptional(src, cursor);
  const options = optional?.body ?? '';
  if (optional) cursor = optional.end;

  const bodyStart = cursor;
  let depth = 1;
  const marker = new RegExp(`\\\\(begin|end)\\{${escapeRegex(name)}\\}`, 'g');
  marker.lastIndex = cursor;

  let match: RegExpExecArray | null;
  while ((match = marker.exec(src)) !== null) {
    depth += match[1] === 'begin' ? 1 : -1;
    if (depth === 0) {
      return {
        name, options, body: src.slice(bodyStart, match.index),
        start: at, end: match.index + match[0].length, bodyStart,
      };
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split on a top-level delimiter, ignoring any occurrence inside braces or a
 * nested environment — how `&` between table cells has to be found.
 */
export function splitTopLevel(src: string, delimiter: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  const scan = new RegExp(delimiter.source, 'g');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      scan.lastIndex = i;
      const hit = scan.exec(src);
      if (hit && hit.index === i && depth === 0) {
        parts.push(src.slice(last, i));
        i = hit.index + hit[0].length - 1;
        last = i + 1;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0) {
      scan.lastIndex = i;
      const hit = scan.exec(src);
      if (hit && hit.index === i) {
        parts.push(src.slice(last, i));
        i = hit.index + hit[0].length - 1;
        last = i + 1;
      }
    }
  }
  parts.push(src.slice(last));
  return parts;
}
