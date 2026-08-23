/** Getting a document out of the editor: file, clipboard, or paper. */

import type { DocFormat } from '@/lib/types';

const EXTENSIONS: Record<DocFormat, string> = { mdx: 'md', latex: 'tex' };

function fileNameFor(name: string, format: DocFormat): string {
  const slug = name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'document';
  return `${slug}.${EXTENSIONS[format]}`;
}

/** Download the source as a .md/.tex file. */
export function downloadSource(name: string, content: string, format: DocFormat) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameFor(name, format);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/**
 * Print the rendered preview rather than the app.
 *
 * A `@media print` block in the stylesheet hides the chrome whenever the body
 * carries `printing-preview`, which keeps KaTeX and highlight styles applied —
 * a popup window would have neither.
 */
export function printPreview(): void {
  document.body.classList.add('printing-preview');
  const cleanup = () => {
    document.body.classList.remove('printing-preview');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Safari doesn't always fire afterprint; drop the class regardless.
  setTimeout(cleanup, 1000);
}

/**
 * TeX's ten special characters, so a document name can be a document name.
 *
 * A project called "Cost & Benefit" or "50% Faster" produced a `\title{}` that
 * would not compile — which defeats the point of an export meant to go
 * straight into a TeX toolchain.
 *
 * One pass, via a lookup. Chained `.replace()` calls corrupt each other here:
 * escaping the backslash first emits `\textbackslash{}`, whose braces the
 * brace rule then escapes in turn.
 */
const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_',
  '{': '\\{', '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function escapeLatex(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, ch => LATEX_ESCAPES[ch] ?? ch);
}

/**
 * A minimal LaTeX document wrapping the body, so what the editor holds can be
 * compiled by a real TeX toolchain without hand-editing.
 */
export function wrapLatexDocument(name: string, body: string): string {
  if (/\\documentclass/.test(body)) return body;
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage{amsmath,amssymb,graphicx,hyperref}',
    `\\title{${escapeLatex(name)}}`,
    '\\begin{document}',
    '\\maketitle',
    '',
    body,
    '',
    '\\end{document}',
  ].join('\n');
}
