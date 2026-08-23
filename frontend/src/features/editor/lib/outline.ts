/**
 * What counts as a heading, and the outline that follows from it.
 *
 * This is the *single* definition. It used to be two — a line-anchored one in
 * `sections.ts` for rewriting markup, and a looser document-wide regex here
 * for display — and they disagreed. Rows appeared in the rail that no
 * structural operation could find, so clicking rename, indent or move on them
 * did nothing at all and said nothing about why.
 */

import type { DocFormat } from '@/lib/types';

export interface OutlineNode {
  id: string;
  label: string;
  /** 1 = top level, re-based for display. See `normalise`. */
  level: number;
  /** Character offset of the start of the heading's line. */
  offset: number;
  /** Zero-based source line. */
  line: number;
}

/**
 * A heading exactly as it is written in the source.
 *
 * `buildOutline` re-bases and clamps levels so the rail reads well, which is
 * right for display and wrong for editing: rewriting `###` needs to know it is
 * three hashes, not that it is drawn at depth two. Every operation that
 * changes markup works from these instead.
 */
export interface RawHeading {
  lineStart: number;
  /** Index of the newline that ends the line, or the end of the document. */
  lineEnd: number;
  /** Depth the markup actually spells, before any display re-basing. */
  level: number;
  title: string;
  /**
   * Where the title text sits. A rename splices here rather than rebuilding
   * the line, so `\section*`, `\part`, closing `###` and the line's own
   * indentation all survive being renamed.
   */
  titleStart: number;
  titleEnd: number;
  line: number;
}

const LATEX_LEVELS: Record<string, number> = {
  part: 1,
  chapter: 1,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 5,
};

// Both are anchored to the whole line, which is what keeps `% \section{...}`
// and prose that merely mentions `\section{x}` mid-sentence out of the
// outline. The LaTeX title is greedy to the last brace on the line, so
// `\section{The \texttt{foo} problem}` keeps its braces instead of being cut
// at the first one.
const LATEX_HEADING =
  /^([^\S\n]*\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{)(.*)(\}[^\S\n]*)$/;
const MDX_HEADING = /^([^\S\n]{0,3}(#{1,6})[^\S\n]+)(.*?)([^\S\n]*#*[^\S\n]*)$/;

/** Every heading in the document, with the depth its markup actually spells. */
export function rawHeadings(content: string, format: DocFormat): RawHeading[] {
  const found: RawHeading[] = [];
  let offset = 0;
  let inFence = false;

  content.split('\n').forEach((text, line) => {
    const lineEnd = offset + text.length;

    if (format === 'mdx' && /^\s*```/.test(text)) {
      inFence = !inFence;
    } else if (!inFence) {
      const match = (format === 'latex' ? LATEX_HEADING : MDX_HEADING).exec(text);
      if (match) {
        const [, opening, marker, title] = match;
        found.push({
          lineStart: offset,
          lineEnd,
          level: format === 'latex' ? LATEX_LEVELS[marker] ?? 3 : marker.length,
          title: title.trim(),
          titleStart: offset + opening.length,
          titleEnd: offset + opening.length + title.length,
          line,
        });
      }
    }

    offset = lineEnd + 1;
  });

  return found;
}

/** The outline as the rail draws it: display levels, and labels without markup. */
export function buildOutline(content: string, format: DocFormat): OutlineNode[] {
  return normalise(rawHeadings(content, format).map(heading => ({
    id: `h-${heading.lineStart}`,
    label: headingLabel(heading.title),
    level: heading.level,
    offset: heading.lineStart,
    line: heading.line,
  })));
}

/**
 * Re-base levels so a document that starts at `##` still renders flush left,
 * and clamp jumps (`#` → `####`) to one step so the rail stays readable.
 */
function normalise(nodes: OutlineNode[]): OutlineNode[] {
  if (!nodes.length) return nodes;
  const base = Math.min(...nodes.map(n => n.level));
  let previous = 1;
  return nodes.map(node => {
    const level = Math.min(node.level - base + 1, previous + 1);
    previous = level;
    return { ...node, level };
  });
}

/**
 * A heading's title as the reader sees it, with inline markup taken off.
 *
 * Exported because anything matching a rail row against the document has to
 * compare the *same* string the rail shows. Comparing a row's label against
 * raw source is how a heading like `## **Bold** heading` failed to match
 * itself, and applying an outline duplicated the section instead of keeping it.
 */
export function headingLabel(label: string): string {
  return label
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

/** The node the caret currently sits in — the last one at or before it. */
export function activeNode(nodes: OutlineNode[], caret: number): string | null {
  let active: string | null = null;
  for (const node of nodes) {
    if (node.offset > caret) break;
    active = node.id;
  }
  return active;
}
