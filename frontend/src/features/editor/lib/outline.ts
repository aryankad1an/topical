/**
 * Document outline — the spine of the navigator rail.
 *
 * Long documents are the normal case here (a generated lesson plan runs to
 * dozens of sections), and scrolling a textarea to find one is miserable.
 */

import type { DocFormat } from '@/lib/types';

export interface OutlineNode {
  id: string;
  label: string;
  /** 1 = top level. Mirrors heading depth in both formats. */
  level: number;
  /** Character offset of the heading in the source. */
  offset: number;
  /** Zero-based source line. */
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

export function buildOutline(content: string, format: DocFormat): OutlineNode[] {
  return format === 'latex' ? latexOutline(content) : markdownOutline(content);
}

function markdownOutline(content: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const lines = content.split('\n');
  let offset = 0;
  let inFence = false;

  lines.forEach((text, line) => {
    if (/^\s*```/.test(text)) inFence = !inFence;
    else if (!inFence) {
      const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*$/.exec(text);
      if (heading) {
        nodes.push({
          id: `h-${line}`,
          label: stripInline(heading[2]),
          level: heading[1].length,
          offset,
          line,
        });
      }
    }
    offset += text.length + 1;
  });

  return normalise(nodes);
}

function latexOutline(content: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const pattern = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}|\\title\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const isTitle = match[3] !== undefined;
    nodes.push({
      id: `s-${match.index}`,
      label: stripInline(isTitle ? match[3] : match[2]),
      level: isTitle ? 1 : LATEX_LEVELS[match[1]] ?? 3,
      offset: match.index,
      line: content.slice(0, match.index).split('\n').length - 1,
    });
  }

  return normalise(nodes);
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

function stripInline(label: string): string {
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
