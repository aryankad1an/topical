/**
 * A proposed outline, and the heading markup an outline turns into.
 *
 * This is *not* the editor's outline — that is the document's own headings,
 * read straight out of the text (see `sections.ts`). A `PlanItem[]` only ever
 * represents structure that does not exist on the page yet: what a model has
 * suggested and the writer has not accepted.
 *
 * Flat, with an explicit level rather than nesting, because that is the shape
 * headings actually have and it maps one-to-one onto `#`/`\section` depth.
 */

import type { DocFormat, TopicHierarchy } from '@/lib/types';
import { headingLabel } from './outline';

export interface PlanItem {
  id: string;
  title: string;
  /** 1-based heading depth. */
  level: number;
}

/** Headings stop being meaningful past this, in both formats. */
export const MAX_PLAN_LEVEL = 6;

/** LaTeX has no `######`; past subparagraph there is nowhere left to go. */
const LATEX_COMMANDS = [
  'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph',
];

let seq = 0;
export function planItem(title: string, level = 1): PlanItem {
  seq += 1;
  return { id: `p${Date.now().toString(36)}-${seq}`, title, level };
}

/** The two-level shape the AI service returns, widened to the flat model. */
export function planFromHierarchy(hierarchy: TopicHierarchy[]): PlanItem[] {
  return hierarchy.flatMap(entry => [
    planItem(entry.topic, 1),
    ...(entry.subtopics ?? []).map(sub => planItem(sub, 2)),
  ]);
}

/**
 * Force the list into a shape that can be rendered as headings: it starts at
 * the top level, and no step down is bigger than one. Without this an outdent
 * in the middle can leave a level-3 item as the first row, which reads as a
 * missing parent rather than a deliberate depth.
 */
export function normalise(items: PlanItem[]): PlanItem[] {
  let previous = 0;
  return items.map(item => {
    const level = Math.min(Math.max(1, item.level), previous + 1, MAX_PLAN_LEVEL);
    previous = level;
    return item.level === level ? item : { ...item, level };
  });
}

/** One heading line, in whichever markup the document is written in. */
export function headingMarkup(title: string, level: number, format: DocFormat): string {
  const depth = Math.max(1, Math.min(level, MAX_PLAN_LEVEL));
  if (format === 'latex') {
    return `\\${LATEX_COMMANDS[Math.min(depth, LATEX_COMMANDS.length) - 1]}{${title}}`;
  }
  return `${'#'.repeat(depth)} ${title}`;
}

/** Indented plain text — what the model reads as "the rest of the document". */
export function planToOutlineText(items: { title: string; level: number }[]): string {
  return items
    .filter(item => item.title.trim())
    .map(item => `${'  '.repeat(item.level - 1)}- ${item.title}`)
    .join('\n');
}

/**
 * Generated sections open with their own heading, because that is what the
 * prompt asks for. When the section is being filed under a heading that is
 * already in the document, that opening line is a duplicate.
 */
export function stripLeadingHeading(text: string, title: string, format: DocFormat): string {
  const body = text.trimStart();
  // Compared as labels: the model may emit `## **Topic**` for a section the
  // outline calls `Topic`, and a raw comparison would leave both headings in.
  const wanted = headingLabel(title).toLowerCase();

  const pattern = format === 'latex'
    ? /^\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}[^\S\n]*\n?/
    : /^ {0,3}#{1,6}[^\S\n]+([^\n]*?)[^\S\n]*#*[^\S\n]*(?:\n|$)/;

  const match = pattern.exec(body);
  if (!match) return body;
  if (headingLabel(match[1]).toLowerCase() !== wanted) return body;
  return body.slice(match[0].length).trimStart();
}
