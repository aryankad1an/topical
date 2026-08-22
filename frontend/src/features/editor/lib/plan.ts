/**
 * The generation plan — the editable outline in the AI panel.
 *
 * Distinct from `outline.ts`, which reads headings *out of* a finished
 * document. This is the other direction: a structure the writer edits before
 * any prose exists, which then becomes the document's headings.
 *
 * Stored flat with an explicit level rather than as a nested tree. Nesting
 * makes indent, outdent and reorder into tree surgery; a flat list with a
 * depth number makes each of them a slice and a number change, and it maps
 * one-to-one onto the heading levels it ends up as.
 */

import type { DocFormat, TopicHierarchy } from '@/lib/types';

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

/**
 * An item and everything nested under it. Indent, outdent, move and delete all
 * act on this range — moving a parent while leaving its children behind is
 * never what someone means by "move this section".
 */
export function subtree(items: PlanItem[], index: number): number {
  let end = index + 1;
  while (end < items.length && items[end].level > items[index].level) end += 1;
  return end;
}

export function indexOfId(items: PlanItem[], id: string): number {
  return items.findIndex(item => item.id === id);
}

export function indent(items: PlanItem[], id: string): PlanItem[] {
  const i = indexOfId(items, id);
  // The first row has no previous sibling to nest under, so it cannot indent.
  if (i <= 0) return items;
  if (items[i].level > items[i - 1].level) return items; // already as deep as its parent allows
  const end = subtree(items, i);
  const next = items.map((item, j) =>
    j >= i && j < end ? { ...item, level: Math.min(item.level + 1, MAX_PLAN_LEVEL) } : item);
  return normalise(next);
}

export function outdent(items: PlanItem[], id: string): PlanItem[] {
  const i = indexOfId(items, id);
  if (i < 0 || items[i].level <= 1) return items;
  const end = subtree(items, i);
  const next = items.map((item, j) =>
    j >= i && j < end ? { ...item, level: item.level - 1 } : item);
  return normalise(next);
}

/**
 * Swap an item, with its children, past the sibling above or below it.
 *
 * Strictly between siblings: an item with no sibling in that direction stays
 * put rather than being hoisted out of its parent, which would silently
 * change its depth as well as its position.
 */
export function move(items: PlanItem[], id: string, direction: -1 | 1): PlanItem[] {
  const i = indexOfId(items, id);
  if (i < 0) return items;
  const level = items[i].level;
  const end = subtree(items, i);
  const block = items.slice(i, end);

  if (direction === -1) {
    // Walk back to the start of the previous block at this level, stopping if
    // a shallower item appears first — that is this item's parent.
    let start = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (items[j].level < level) break;
      if (items[j].level === level) { start = j; break; }
    }
    if (start < 0) return items;
    return normalise([
      ...items.slice(0, start),
      ...block,
      ...items.slice(start, i),
      ...items.slice(end),
    ]);
  }

  // Moving down: the next sibling is whatever sits at `end`, provided it is
  // still at this level rather than closing the parent out.
  if (end >= items.length || items[end].level !== level) return items;
  const afterSibling = subtree(items, end);
  return normalise([
    ...items.slice(0, i),
    ...items.slice(end, afterSibling),
    ...block,
    ...items.slice(afterSibling),
  ]);
}

/** A new sibling directly below the item, past any children it has. */
export function addAfter(items: PlanItem[], id: string, title = ''): { items: PlanItem[]; created: PlanItem } {
  const i = indexOfId(items, id);
  const created = planItem(title, i < 0 ? 1 : items[i].level);
  if (i < 0) return { items: normalise([...items, created]), created };
  const end = subtree(items, i);
  return { items: normalise([...items.slice(0, end), created, ...items.slice(end)]), created };
}

export function remove(items: PlanItem[], id: string): PlanItem[] {
  const i = indexOfId(items, id);
  if (i < 0) return items;
  return normalise([...items.slice(0, i), ...items.slice(subtree(items, i))]);
}

export function rename(items: PlanItem[], id: string, title: string): PlanItem[] {
  return items.map(item => (item.id === id ? { ...item, title } : item));
}

/** One heading, in whichever markup the document is written in. */
export function headingFor(item: PlanItem, format: DocFormat): string {
  if (format === 'latex') {
    return `\\${LATEX_COMMANDS[Math.min(item.level, LATEX_COMMANDS.length) - 1]}{${item.title}}`;
  }
  return `${'#'.repeat(Math.min(item.level, MAX_PLAN_LEVEL))} ${item.title}`;
}

/** The whole plan as a heading skeleton, ready to drop into the document. */
export function planToDocument(items: PlanItem[], format: DocFormat): string {
  return items
    .filter(item => item.title.trim())
    .map(item => headingFor(item, format))
    .join('\n\n');
}

/** Indented plain text — what the model reads as "the rest of the document". */
export function planToOutlineText(items: PlanItem[]): string {
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
  const wanted = title.trim().toLowerCase();

  const pattern = format === 'latex'
    ? /^\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}[^\S\n]*\n?/
    : /^ {0,3}#{1,6}[^\S\n]+([^\n]*?)[^\S\n]*#*[^\S\n]*(?:\n|$)/;

  const match = pattern.exec(body);
  if (!match) return body;
  if (match[1].trim().toLowerCase() !== wanted) return body;
  return body.slice(match[0].length).trimStart();
}
