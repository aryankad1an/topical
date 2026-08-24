/**
 * The outline as a tree, indexed once.
 *
 * The document's headings are stored — correctly — as a flat list with an
 * explicit level, because that is the shape headings actually have. But every
 * question worth asking about them is a *tree* question: what sits under this
 * row, what is this row nested inside, where does its subtree stop, what
 * number would a reader give it. Answering those by re-scanning the flat list
 * at each call site is how the rail ended up walking the whole outline once
 * per row per render — and how "children of" and "where the subtree ends"
 * came to be computed in three places with two slightly different answers.
 *
 * This builds the parent/child/ancestor relations in one pass and hands back
 * an index everything else reads. Nothing here mutates the outline: the
 * document is still the only structure, and this is a view of it.
 */

import type { OutlineNode } from './outline';

export interface OutlineEntry {
  node: OutlineNode;
  /** Position in the flat list — the identity used everywhere in this module. */
  index: number;
  parent: number | null;
  children: number[];
  /**
   * 1-based sibling numbering, root first. `[2, 3]` is the third child of the
   * second top-level section, which is what a reader would call §2.3.
   */
  path: number[];
  /** One past the last descendant, so `nodes.slice(index, subtreeEnd)` is the subtree. */
  subtreeEnd: number;
}

export interface OutlineTree {
  nodes: OutlineNode[];
  entries: OutlineEntry[];
  roots: number[];
  /** Source offset of a heading line → its index. */
  byOffset: Map<number, number>;
}

const EMPTY: OutlineTree = { nodes: [], entries: [], roots: [], byOffset: new Map() };

/**
 * Build the index. One pass down for parents and paths, one pass back up for
 * subtree ends.
 *
 * Levels arrive already normalised by `buildOutline` — no step down is bigger
 * than one — so a stack of open ancestors is enough; a row's parent is
 * whatever is still open above its own level.
 */
export function indexOutline(nodes: OutlineNode[]): OutlineTree {
  if (!nodes.length) return EMPTY;

  const entries: OutlineEntry[] = [];
  const roots: number[] = [];
  const byOffset = new Map<number, number>();
  /** Indices of the sections currently open, one per depth. */
  const open: number[] = [];

  nodes.forEach((node, index) => {
    // Close everything at this depth or deeper: those subtrees end here.
    while (open.length >= node.level) open.pop();

    const parent = open.length ? open[open.length - 1] : null;
    const siblings = parent === null ? roots : entries[parent].children;
    const path = parent === null ? [roots.length + 1] : [...entries[parent].path, siblings.length + 1];

    entries.push({ node, index, parent, children: [], path, subtreeEnd: nodes.length });
    siblings.push(index);
    byOffset.set(node.offset, index);
    open.push(index);
  });

  // A subtree stops at the first later row that is not below it.
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    let end = i + 1;
    while (end < nodes.length && nodes[end].level > nodes[i].level) end += 1;
    entries[i].subtreeEnd = end;
  }

  return { nodes, entries, roots, byOffset };
}

/** The entry for a heading at a source offset, if it is still there. */
export function entryAtOffset(tree: OutlineTree, offset: number | null): OutlineEntry | null {
  if (offset === null) return null;
  const index = tree.byOffset.get(offset);
  return index === undefined ? null : tree.entries[index];
}

/** Titles of the rows nested *directly* under one — what its introduction must not cover. */
export function childTitles(tree: OutlineTree, index: number): string[] {
  return (tree.entries[index]?.children ?? []).map(child => tree.nodes[child].label);
}

/** Titles from the top of the document down to (but not including) this row. */
export function ancestorTitles(tree: OutlineTree, index: number): string[] {
  const titles: string[] = [];
  let entry = tree.entries[index] ?? null;
  while (entry && entry.parent !== null) {
    entry = tree.entries[entry.parent];
    titles.unshift(entry.node.label);
  }
  return titles;
}

/** "2.3" — the number a reader would give this section. */
export function pathNumber(entry: OutlineEntry): string {
  return entry.path.join('.');
}

/**
 * The span of document a row stands for: its heading through the end of
 * everything nested under it.
 *
 * This is the range the editor highlights when a row is touched in the rail,
 * so "the thing I am manipulating" and "the thing selected in the document"
 * are the same thing rather than two guesses at it.
 */
export function subtreeSpan(
  tree: OutlineTree,
  index: number,
  contentLength: number,
): { start: number; end: number } | null {
  const entry = tree.entries[index];
  if (!entry) return null;
  const next = tree.nodes[entry.subtreeEnd];
  return { start: entry.node.offset, end: next ? next.offset : contentLength };
}

interface DigestOptions {
  /** Words written under each heading, for marking what is still a promise. */
  words?: (node: OutlineNode) => number;
  /** The row being written, marked so the model can see where it is. */
  focus?: number | null;
  /** Rough cap, so a 200-section document does not eat the context window. */
  maxChars?: number;
}

/**
 * The outline as the model should read it: numbered, indented, and honest
 * about what is already on the page.
 *
 * The old version sent a bare indented list of titles. That tells a model what
 * the other sections are *called* and nothing about where the section it is
 * writing sits, which of its neighbours already exist, or how deep it is — so
 * "do not overlap with the other sections" was an instruction it had no way to
 * follow. Numbering gives every row an address, and the written/empty marks
 * turn "avoid the others" into something checkable: prose already exists for
 * these, so do not write it again.
 */
export function outlineDigest(tree: OutlineTree, options: DigestOptions = {}): string {
  const { words, focus = null, maxChars = 4000 } = options;
  const lines: string[] = [];

  for (const entry of tree.entries) {
    const title = entry.node.label.trim();
    if (!title) continue;
    const indent = '  '.repeat(entry.path.length - 1);
    const state = words ? (words(entry.node) > 0 ? ' [written]' : ' [not written yet]') : '';
    const here = entry.index === focus ? '   <-- the section you are writing now' : '';
    lines.push(`${indent}${pathNumber(entry)}. ${title}${state}${here}`);
  }

  const text = lines.join('\n');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…`;
}
