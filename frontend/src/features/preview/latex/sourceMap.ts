/**
 * Tracing a rendered position back to the line that produced it.
 *
 * The renderer runs the source through five passes before a single tag is
 * emitted — verbatim is lifted out, comments are stripped, the preamble is
 * removed, macros are expanded, maths is lifted out — and every one of them
 * changes offsets: a stripped comment removes characters that were never
 * rendered, an expanded macro adds characters that came from its definition
 * rather than from the line that invoked it, and a multi-line equation
 * collapses to a few placeholder characters. By the time `renderBlocks` sees
 * the text, "character 900" no longer means character 900 of what the writer
 * typed.
 *
 * A `SourceMap` is the running answer to "where did this character actually
 * come from": one entry per character of the *current* string, holding its
 * offset in the true original source. Each pass produces its own map from
 * the one it was handed, so the composition survives the whole pipeline —
 * `renderBlocks` only ever has to ask the final map, never know the passes
 * happened.
 */

/** `map[i]` is the original-source offset behind output character `i`, or
 *  `-1` for a character with no single origin (synthesized by a macro
 *  expansion or a placeholder). */
export type SourceMap = Int32Array;

/** The map for the original source itself: character `i` came from `i`. */
export function identitySourceMap(length: number): SourceMap {
  const map = new Int32Array(length);
  for (let i = 0; i < length; i++) map[i] = i;
  return map;
}

/**
 * The original offset nearest at-or-before `at`.
 *
 * Falls back rather than failing on a `-1` entry: a click inside an expanded
 * macro or a collapsed equation has no exact character to point at, and "the
 * start of whatever produced this" is the right answer for a block-level
 * jump, not "nowhere".
 */
export function originOf(map: SourceMap, at: number): number {
  const clamped = Math.min(Math.max(at, 0), map.length - 1);
  for (let i = clamped; i >= 0; i--) {
    if (map[i] >= 0) return map[i];
  }
  return 0;
}

/** A string being built alongside the map of where each of its characters
 *  came from. Every pass takes one and returns one. */
export interface Mapped {
  text: string;
  map: SourceMap;
}

/** A `Mapped` builder: append characters and their origins one at a time,
 *  the shape every pass's main loop already has. */
export class MappedBuilder {
  private text = '';
  private origins: number[] = [];

  /** Append one character, attributed to `origin` (an index into the input
   *  map/source), or with no single origin if omitted. */
  push(ch: string, origin = -1) {
    this.text += ch;
    this.origins.push(origin);
  }

  /** Append a whole run, every character attributed to the same origin —
   *  what a placeholder or a macro expansion needs. */
  pushRun(chars: string, origin: number) {
    this.text += chars;
    for (let i = 0; i < chars.length; i++) this.origins.push(origin);
  }

  result(): Mapped {
    return { text: this.text, map: Int32Array.from(this.origins) };
  }
}

/**
 * Delete every match of `pattern` (which must be global) from `text`,
 * dropping the same span from `map` so the two stay the same length.
 *
 * The preamble strips several command families this way — `\usepackage`,
 * `\setlength`, and the rest carry no rendered content, so there is nothing
 * to attribute a line to; they are removed, not mapped.
 */
export function removeMatches(text: string, map: SourceMap, pattern: RegExp): Mapped {
  if (!pattern.global) throw new Error('removeMatches requires a global pattern');
  let result = '';
  const origins: number[] = [];
  let last = 0;
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    result += text.slice(last, match.index);
    for (let i = last; i < match.index; i++) origins.push(map[i]);
    last = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex++;
  }
  result += text.slice(last);
  for (let i = last; i < text.length; i++) origins.push(map[i]);

  return { text: result, map: Int32Array.from(origins) };
}

/** Delete the span `[start, end)` from both `text` and `map` — the shape
 *  every explicit `slice(0, a) + slice(b)` splice in the preamble reader
 *  needs done to both at once. */
export function removeSpan(text: string, map: SourceMap, start: number, end: number): Mapped {
  const before = map.slice(0, start);
  const after = map.slice(end);
  const merged = new Int32Array(before.length + after.length);
  merged.set(before);
  merged.set(after, before.length);
  return { text: text.slice(0, start) + text.slice(end), map: merged };
}
