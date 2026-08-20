/**
 * Preamble handling: document metadata and user-defined macros.
 *
 * Macros matter more than they look. Anyone writing real maths defines
 * `\newcommand{\R}{\mathbb{R}}` in their first ten lines, and a preview that
 * ignores them shows `\R` as an error on every page.
 */

import { readGroup, readOptional } from './parser';

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
}

const DROP_COMMANDS = [
  'documentclass', 'usepackage', 'geometry', 'pagestyle', 'thispagestyle',
  'setlength', 'renewcommand\\*', 'bibliographystyle', 'bibliography',
  'addbibresource', 'setcounter', 'linespread', 'graphicspath', 'hypersetup',
];

export function extractPreamble(src: string): Preamble {
  let title = '';
  let author = '';
  let date = '';
  const macros = new Map<string, Macro>();

  // Metadata — read with brace matching so `\title{A {B} C}` survives.
  const meta = (name: string): string => {
    const at = src.indexOf(`\\${name}{`);
    if (at === -1) return '';
    const group = readGroup(src, at + name.length + 1);
    if (!group) return '';
    src = src.slice(0, at) + src.slice(group.end);
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
    let arity = readOptional(src, cursor);
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
    src = src.slice(0, start) + src.slice(end);
  }

  // Structural commands that carry no visible content.
  for (const name of DROP_COMMANDS) {
    src = src.replace(new RegExp(`\\\\${name}(\\[[^\\]]*\\])?(\\{[^}]*\\})*`, 'g'), '');
  }
  src = src
    .replace(/\\begin\{document\}|\\end\{document\}/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\(?:clearpage|newpage|pagebreak|noindent|centering|raggedright|small|footnotesize|normalsize|large|Large|huge|Huge)\b/g, '');

  return { title, author, date, macros, body: src };
}

const MAX_EXPANSIONS = 8;

/** Substitute user macros, repeatedly, so macros defined in terms of macros resolve. */
export function expandMacros(src: string, macros: Map<string, Macro>): string {
  if (macros.size === 0) return src;

  let text = src;
  for (let pass = 0; pass < MAX_EXPANSIONS; pass++) {
    let changed = false;
    let out = '';
    let i = 0;

    while (i < text.length) {
      if (text[i] !== '\\') {
        out += text[i++];
        continue;
      }
      const name = /^\\([a-zA-Z@]+)/.exec(text.slice(i));
      const macro = name && macros.get(name[1]);
      if (!name || !macro) {
        out += text[i] + (text[i + 1] ?? '');
        i += 2;
        continue;
      }

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
        out += text.slice(i, cursor);
        i = cursor;
        continue;
      }

      out += macro.body.replace(/#(\d)/g, (_, n) => args[Number(n) - 1] ?? '');
      i = cursor;
      changed = true;
    }

    text = out;
    if (!changed) break;
  }
  return text;
}
