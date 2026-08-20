/** Live document measurements for the status bar. */

import type { DocFormat } from '@/lib/types';

export interface DocStats {
  words: number;
  chars: number;
  sentences: number;
  paragraphs: number;
  /** Minutes at 200 wpm, the usual prose average. */
  readMinutes: number;
}

/** Strip markup so a heading's `##` doesn't count as a word. */
function plainText(content: string, format: DocFormat): string {
  if (format === 'latex') {
    return content
      .replace(/(?<!\\)%[^\n]*/g, ' ')
      .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, ' ')
      .replace(/\\[a-zA-Z@]+\*?/g, ' ')
      .replace(/[{}$&#~^_\\]/g, ' ');
  }
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ');
}

export function documentStats(content: string, format: DocFormat): DocStats {
  const text = plainText(content, format).trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const sentences = text ? (text.match(/[.!?](?:\s|$)/g) ?? []).length : 0;
  const paragraphs = content.trim() ? content.trim().split(/\n\s*\n/).length : 0;

  return {
    words,
    chars: content.length,
    sentences,
    paragraphs,
    readMinutes: Math.max(1, Math.round(words / 200)),
  };
}

/** Word count of an arbitrary slice — used for "N words selected". */
export function countWords(text: string, format: DocFormat): number {
  const plain = plainText(text, format).trim();
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0;
}
