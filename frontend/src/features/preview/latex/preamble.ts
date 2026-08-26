/**
 * Preamble handling: document metadata and user-defined macros.
 *
 * Macros matter more than they look. Anyone writing real maths defines
 * `\newcommand{\R}{\mathbb{R}}` in their first ten lines, and a preview that
 * ignores them shows `\R` as an error on every page.
 */

import { readGroup, readOptional } from './parser';
import { MappedBuilder, removeMatches, removeSpan, type Mapped, type SourceMap } from './sourceMap';

export interface Macro {
  params: number;
  body: string;
  /** Default value for the first argument when declared with `[n][default]`. */
  optionalDefault?: string;
}

export interface Preamble {
  title: string;
  author: string;
  date: string;
  macros: Map<string, Macro>;
  /** Everything left to render, with preamble commands removed. */
  body: string;
  /** `body`'s map back to the original source — see `sourceMap.ts`. */
  map: SourceMap;
}

const DROP_COMMANDS = [
  'documentclass', 'usepackage', 'geometry', 'pagestyle', 'thispagestyle',
  'setlength', 'renewcommand\\*', 'bibliographystyle', 'bibliography',
  'addbibresource', 'setcounter', 'linespread', 'graphicspath', 'hypersetup',
];

export function extractPreamble(src: string, sourceMap: SourceMap): Preamble {
  let title = '';
  let author = '';
  let date = '';
  const macros = new Map<string, Macro>();
  // Both mutate together throughout — every splice below removes the same
  // span from each, so `map` keeps meaning "where did this character of
  // `src` come from" right up to the point `renderBlocks` starts reading it.
  let map = sourceMap;

  // Metadata — read with brace matching so `\title{A {B} C}` survives.
  const meta = (name: string): string => {
    const at = src.indexOf(`\\${name}{`);
    if (at === -1) return '';
    const group = readGroup(src, at + name.length + 1);
    if (!group) return '';
    ({ text: src, map } = removeSpan(src, map, at, group.end));
    return group.body.trim();
  };
  title = meta('title');
  author = meta('author');
  date = meta('date');

  // \newcommand / \renewcommand / \def / \DeclareMathOperator
  const declaration = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator)\*?\s*/g;
  let match: RegExpExecArray | null;
  const removals: [number, number][] = [];

  while ((match = declaration.exec(src)) !== null) {
    let cursor = match.index + match[0].length;
    // Name, either `{\foo}` or bare `\foo`.
    let name = '';
    if (src[cursor] === '{') {
      const group = readGroup(src, cursor);
      if (!group) continue;
      name = group.body.trim().replace(/^\\/, '');
      cursor = group.end;
    } else {
      const bare = /^\\([a-zA-Z@]+)/.exec(src.slice(cursor));
      if (!bare) continue;
      name = bare[1];
      cursor += bare[0].length;
    }

    let params = 0;
    let optionalDefault: string | undefined;
    const arity = readOptional(src, cursor);
    if (arity) {
      params = Number(arity.body.trim()) || 0;
      cursor = arity.end;
      const fallback = readOptional(src, cursor);
      if (fallback) {
        optionalDefault = fallback.body;
        cursor = fallback.end;
      }
    }

    const body = readGroup(src, cursor);
    if (!body) continue;
    // \DeclareMathOperator{\argmax}{arg\,max} defines an operator, not a macro body.
    const isOperator = match[1] === 'DeclareMathOperator';
    macros.set(name, {
      params,
      body: isOperator ? `\\operatorname{${body.body}}` : body.body,
      optionalDefault,
    });
    removals.push([match.index, body.end]);
  }

  for (const [start, end] of removals.reverse()) {
    ({ text: src, map } = removeSpan(src, map, start, end));
  }

  // Structural commands that carry no visible content.
  for (const name of DROP_COMMANDS) {
    ({ text: src, map } = removeMatches(src, map, new RegExp(`\\\\${name}(\\[[^\\]]*\\])?(\\{[^}]*\\})*`, 'g')));
  }
  ({ text: src, map } = removeMatches(src, map, /\\begin\{document\}|\\end\{document\}/g));
  ({ text: src, map } = removeMatches(src, map, /\\maketitle/g));
  ({ text: src, map } = removeMatches(
    src, map,
    /\\(?:clearpage|newpage|pagebreak|noindent|centering|raggedright|small|footnotesize|normalsize|large|Large|huge|Huge)\b/g,
  ));

  return { title, author, date, macros, body: src, map };
}

const MAX_EXPANSIONS = 8;

/**
 * Substitute user macros, repeatedly, so macros defined in terms of macros
 * resolve.
 *
 * A macro's expansion is text from its *definition*, not from the line that
 * invoked it — there is no single source character behind `\mathbb{R}` when
 * `\R` is what the writer typed. Every character the expansion contributes is
 * attributed to the invocation site instead: close enough for a block-level
 * jump, and exactly what a writer means by "where is this in my document" —
 * the call site, not a macro they may have defined once and forgotten.
 */
export function expandMacros(src: string, macros: Map<string, Macro>, sourceMap: SourceMap): Mapped {
  if (macros.size === 0) return { text: src, map: sourceMap };

  let text = src;
  let map = sourceMap;
  for (let pass = 0; pass < MAX_EXPANSIONS; pass++) {
    let changed = false;
    const out = new MappedBuilder();
    let i = 0;

    while (i < text.length) {
      if (text[i] !== '\\') {
        out.push(text[i], map[i]);
        i++;
        continue;
      }
      const name = /^\\([a-zA-Z@]+)/.exec(text.slice(i));
      const macro = name && macros.get(name[1]);
      if (!name || !macro) {
        out.push(text[i], map[i]);
        if (text[i + 1] !== undefined) out.push(text[i + 1], map[i + 1]);
        i += 2;
        continue;
      }

      const invocationOrigin = map[i];
      let cursor = i + name[0].length;
      const args: string[] = [];
      if (macro.optionalDefault !== undefined) {
        const optional = readOptional(text, cursor);
        args.push(optional ? optional.body : macro.optionalDefault);
        if (optional) cursor = optional.end;
      }
      while (args.length < macro.params) {
        const group = readGroup(text, cursor);
        if (!group) break;
        args.push(group.body);
        cursor = group.end;
      }
      if (args.length < macro.params) {
        // Not enough arguments present — leave it alone rather than mangling.
        for (let j = i; j < cursor; j++) out.push(text[j], map[j]);
        i = cursor;
        continue;
      }

      const expansion = macro.body.replace(/#(\d)/g, (_, n) => args[Number(n) - 1] ?? '');
      out.pushRun(expansion, invocationOrigin);
      i = cursor;
      changed = true;
    }

    ({ text, map } = out.result());
    if (!changed) break;
  }
  return { text, map };
}
