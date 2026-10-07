import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* The type ladder adds `3xs`, `2xs` and `md` to Tailwind's size names (see
   tailwind.config). tailwind-merge must know they are font sizes: unknown
   `text-*` names are read as colours, and a size would silently knock out
   the tone class beside it. */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["3xs", "2xs", "md"] }] } },
});

/** Merge Tailwind class lists, with later classes winning conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Best-effort human-readable message from a caught value of unknown shape. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * A leading `---` … `---` block, with both delimiters on their own lines.
 *
 * This shape alone is not enough to call something frontmatter — see
 * `stripFrontmatter`.
 */
const LEADING_BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** A `key: value` line, a `- list item`, or an indented continuation of either. */
const YAML_LINE = /^(?:[A-Za-z_][\w.-]*[ \t]*:|-[ \t]|[ \t]+\S)/;

/**
 * Drop the YAML frontmatter block from generated markup.
 *
 * Models add one despite being asked not to, and the editor renders raw text —
 * so an unstripped block shows up in the document as literal `title: …` lines.
 *
 * The delimiters are not sufficient evidence on their own. A document that
 * opens with a horizontal rule and contains another one later has exactly the
 * same shape, and this app writes that shape itself: stored documents are
 * topics joined by `\n\n---\n\n`. So the block's contents must also read as
 * YAML before any of it is thrown away — losing a real section of someone's
 * writing is far worse than leaving three stray metadata lines in view.
 */
export function stripFrontmatter(content: string): string {
  if (!content) return '';

  const match = LEADING_BLOCK.exec(content);
  if (!match) return content.trim();

  const lines = match[1].split(/\r?\n/).filter(line => line.trim());
  const isYaml = lines.length > 0 && lines.every(line => YAML_LINE.test(line));

  return (isYaml ? content.slice(match[0].length) : content).trim();
}
