/**
 * The single registry of things you can insert into a document.
 *
 * The toolbar, the ⌘-shortcuts and the `/` menu all read from here, so a
 * construct is defined once and behaves identically however you reach it.
 */

import {
  Bold, Italic, Strikethrough, Code, Code2, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Minus, Link2, Image, Table,
  Sigma, Radical, Info, FileText, Braces, BookMarked, SquareStack, Superscript,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import { toggleWrap, toggleLinePrefix, type EditResult, type Range } from './textOps';

export type ActionGroup = 'Format' | 'Structure' | 'Blocks' | 'Math' | 'Media';

export interface EditorAction {
  id: string;
  label: string;
  hint?: string;
  group: ActionGroup;
  icon: LucideIcon;
  /** Letter or digit combined with ⌘/Ctrl. */
  key?: string;
  /** Whether that shortcut also needs Shift. */
  shift?: boolean;
  /** Keywords the slash menu matches on, beyond the label. */
  terms?: string;
  apply: (doc: string, sel: Range) => EditResult;
}

/**
 * Place a multi-line construct on its own lines.
 *
 * `$SEL` is replaced by the current selection (or the placeholder) and `$0`
 * marks where the caret should land afterwards.
 */
function template(body: string, placeholder = '') {
  return (doc: string, sel: Range): EditResult => {
    const selected = doc.slice(sel.start, sel.end);
    let text = body.replace('$SEL', selected || placeholder);
    const caretAt = text.indexOf('$0');
    text = text.replace('$0', '');

    const before = doc.slice(0, sel.start);
    const after = doc.slice(sel.end);
    // Only add the blank line the construct needs, never a second one.
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const trail = !after || after.startsWith('\n') ? '' : '\n';

    const head = before + lead + text;
    const caret = caretAt >= 0 ? before.length + lead.length + caretAt : head.length;
    return { content: head + trail + after, start: caret, end: caret };
  };
}

function wrap(before: string, after: string, placeholder: string) {
  return (doc: string, sel: Range) => toggleWrap(doc, sel, before, after, placeholder);
}

function prefix(marker: string) {
  return (doc: string, sel: Range) => toggleLinePrefix(doc, sel, marker);
}

// ── Markdown / MDX ────────────────────────────────────────────────────────

const MDX_ACTIONS: EditorAction[] = [
  { id: 'bold', label: 'Bold', group: 'Format', icon: Bold, key: 'b', apply: wrap('**', '**', 'bold text') },
  { id: 'italic', label: 'Italic', group: 'Format', icon: Italic, key: 'i', apply: wrap('*', '*', 'italic text') },
  { id: 'strike', label: 'Strikethrough', group: 'Format', icon: Strikethrough, apply: wrap('~~', '~~', 'struck text') },
  { id: 'code', label: 'Inline code', group: 'Format', icon: Code, key: 'e', apply: wrap('`', '`', 'code') },

  { id: 'h1', label: 'Heading 1', group: 'Structure', icon: Heading1, key: '1', apply: prefix('# ') },
  { id: 'h2', label: 'Heading 2', group: 'Structure', icon: Heading2, key: '2', apply: prefix('## ') },
  { id: 'h3', label: 'Heading 3', group: 'Structure', icon: Heading3, key: '3', apply: prefix('### ') },
  { id: 'ul', label: 'Bulleted list', group: 'Structure', icon: List, apply: prefix('- ') },
  { id: 'ol', label: 'Numbered list', group: 'Structure', icon: ListOrdered, apply: prefix('1. ') },
  { id: 'task', label: 'Task list', group: 'Structure', icon: ListChecks, terms: 'todo checkbox', apply: prefix('- [ ] ') },
  { id: 'quote', label: 'Quote', group: 'Structure', icon: Quote, apply: prefix('> ') },
  { id: 'hr', label: 'Divider', group: 'Structure', icon: Minus, terms: 'rule separator', apply: template('---\n$0') },

  { id: 'link', label: 'Link', group: 'Media', icon: Link2, key: 'k', apply: wrap('[', '](url)', 'label') },
  { id: 'image', label: 'Image', group: 'Media', icon: Image, apply: wrap('![', '](url)', 'alt text') },
  {
    id: 'codeblock', label: 'Code block', group: 'Blocks', icon: Code2, terms: 'fence snippet',
    apply: template('```$0\n$SEL\n```', 'code here'),
  },
  {
    id: 'table', label: 'Table', group: 'Blocks', icon: Table,
    apply: template('| $0Column | Column |\n| --- | --- |\n| Cell | Cell |'),
  },
  {
    id: 'callout', label: 'Callout', group: 'Blocks', icon: Info, terms: 'note warning admonition',
    apply: template('> [!NOTE]\n> $0$SEL', 'Something worth flagging.'),
  },
  {
    id: 'details', label: 'Collapsible section', group: 'Blocks', icon: SquareStack, terms: 'accordion toggle',
    apply: template('<details>\n<summary>$0Summary</summary>\n\n$SEL\n\n</details>', 'Hidden content.'),
  },
  {
    id: 'footnote', label: 'Footnote', group: 'Blocks', icon: Superscript,
    apply: template('$SEL[^1]\n\n[^1]: $0Footnote text.'),
  },

  { id: 'math-inline', label: 'Inline math', group: 'Math', icon: Radical, terms: 'katex equation formula', apply: wrap('$', '$', 'x^2') },
  {
    id: 'math-block', label: 'Display equation', group: 'Math', icon: Sigma, terms: 'katex formula',
    apply: template('$$\n$0$SEL\n$$', 'E = mc^2'),
  },
];

// ── LaTeX ─────────────────────────────────────────────────────────────────

const LATEX_ACTIONS: EditorAction[] = [
  { id: 'bold', label: 'Bold', group: 'Format', icon: Bold, key: 'b', apply: wrap('\\textbf{', '}', 'bold text') },
  { id: 'italic', label: 'Italic', group: 'Format', icon: Italic, key: 'i', apply: wrap('\\textit{', '}', 'italic text') },
  { id: 'strike', label: 'Emphasis', group: 'Format', icon: Strikethrough, apply: wrap('\\emph{', '}', 'emphasis') },
  { id: 'code', label: 'Monospace', group: 'Format', icon: Code, key: 'e', apply: wrap('\\texttt{', '}', 'code') },

  { id: 'h1', label: 'Section', group: 'Structure', icon: Heading1, key: '1', apply: template('\\section{$SEL}$0', 'Section title') },
  { id: 'h2', label: 'Subsection', group: 'Structure', icon: Heading2, key: '2', apply: template('\\subsection{$SEL}$0', 'Subsection title') },
  { id: 'h3', label: 'Subsubsection', group: 'Structure', icon: Heading3, key: '3', apply: template('\\subsubsection{$SEL}$0', 'Subsubsection title') },
  { id: 'ul', label: 'Itemize', group: 'Structure', icon: List, apply: template('\\begin{itemize}\n  \\item $0$SEL\n\\end{itemize}', 'First item') },
  { id: 'ol', label: 'Enumerate', group: 'Structure', icon: ListOrdered, apply: template('\\begin{enumerate}\n  \\item $0$SEL\n\\end{enumerate}', 'First item') },
  { id: 'task', label: 'Description list', group: 'Structure', icon: ListChecks, apply: template('\\begin{description}\n  \\item[$0Term] $SEL\n\\end{description}', 'Definition') },
  { id: 'quote', label: 'Quote', group: 'Structure', icon: Quote, apply: template('\\begin{quote}\n$0$SEL\n\\end{quote}', 'Quoted passage') },
  { id: 'hr', label: 'Rule', group: 'Structure', icon: Minus, apply: template('\\hrule$0') },

  { id: 'link', label: 'Hyperlink', group: 'Media', icon: Link2, key: 'k', apply: wrap('\\href{url}{', '}', 'label') },
  {
    id: 'image', label: 'Figure', group: 'Media', icon: Image, terms: 'graphic includegraphics',
    apply: template(
      '\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{$0image.png}\n  \\caption{$SEL}\n  \\label{fig:label}\n\\end{figure}',
      'Caption',
    ),
  },
  { id: 'codeblock', label: 'Verbatim', group: 'Blocks', icon: Code2, apply: template('\\begin{verbatim}\n$0$SEL\n\\end{verbatim}', 'code here') },
  {
    id: 'table', label: 'Table', group: 'Blocks', icon: Table,
    apply: template(
      '\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{lcr}\n    \\hline\n    $0Left & Center & Right \\\\\n    \\hline\n    a & b & c \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{$SEL}\n\\end{table}',
      'Caption',
    ),
  },
  {
    id: 'callout', label: 'Theorem', group: 'Blocks', icon: BookMarked, terms: 'lemma proof proposition',
    apply: template('\\begin{theorem}\n$0$SEL\n\\end{theorem}', 'State the theorem.'),
  },
  {
    id: 'details', label: 'Proof', group: 'Blocks', icon: SquareStack,
    apply: template('\\begin{proof}\n$0$SEL\n\\end{proof}', 'Argument.'),
  },
  { id: 'footnote', label: 'Footnote', group: 'Blocks', icon: Superscript, apply: wrap('\\footnote{', '}', 'Footnote text.') },
  { id: 'cite', label: 'Citation', group: 'Blocks', icon: FileText, terms: 'reference bibliography', apply: wrap('\\cite{', '}', 'key') },

  { id: 'math-inline', label: 'Inline math', group: 'Math', icon: Radical, apply: wrap('$', '$', 'x^2') },
  { id: 'math-block', label: 'Equation', group: 'Math', icon: Sigma, apply: template('\\begin{equation}\n  $0$SEL\n\\end{equation}', 'E = mc^2') },
  { id: 'align', label: 'Aligned equations', group: 'Math', icon: Braces, terms: 'multi line math', apply: template('\\begin{align}\n  $0a &= b \\\\\n  c &= d\n\\end{align}') },
  { id: 'matrix', label: 'Matrix', group: 'Math', icon: Table, apply: template('\\begin{equation}\n  \\begin{pmatrix}\n    $0a & b \\\\\n    c & d\n  \\end{pmatrix}\n\\end{equation}') },
  { id: 'cases', label: 'Cases', group: 'Math', icon: Braces, terms: 'piecewise', apply: template('\\begin{equation}\n  f(x) = \\begin{cases}\n    $01 & x > 0 \\\\\n    0 & \\text{otherwise}\n  \\end{cases}\n\\end{equation}') },
];

/** Ids the toolbar shows, in order. Everything else lives in the `/` menu. */
/**
 * The formatting bar, as named groups.
 *
 * Named rather than separated by bare `'|'` markers because the bar is a
 * WAI-ARIA toolbar: each group is announced ("Text style, group") before its
 * buttons, which is what makes eighteen unlabelled icons navigable by
 * keyboard. The visual dividers fall out of the same structure, so the
 * grouping a sighted reader sees and the one a screen reader hears cannot
 * drift apart.
 */
export const TOOLBAR_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Text style', ids: ['bold', 'italic', 'code'] },
  { label: 'Headings', ids: ['h1', 'h2', 'h3'] },
  { label: 'Lists and quotes', ids: ['ul', 'ol', 'quote'] },
  { label: 'Blocks', ids: ['codeblock', 'link', 'image', 'table'] },
  { label: 'Maths', ids: ['math-inline', 'math-block'] },
];

/** Flat order, for anything that just needs the ids. */
export const TOOLBAR_IDS = TOOLBAR_GROUPS.flatMap(g => g.ids);

export function actionsFor(format: DocFormat): EditorAction[] {
  return format === 'latex' ? LATEX_ACTIONS : MDX_ACTIONS;
}

export function actionById(format: DocFormat, id: string): EditorAction | undefined {
  return actionsFor(format).find(a => a.id === id);
}

/** The action bound to a ⌘/Ctrl chord, if any. */
export function actionForChord(format: DocFormat, key: string, shift: boolean): EditorAction | undefined {
  return actionsFor(format).find(a => a.key === key.toLowerCase() && Boolean(a.shift) === shift);
}
