import { useCallback } from 'react';
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Link2, Image, Quote, Minus, Sparkles, Upload,
} from 'lucide-react';

interface EditorToolbarProps {
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (c: string) => void;
  setIsDirty: (d: boolean) => void;
  projectType: 'mdx' | 'latex';
  onImageUpload: () => void;
}

export function EditorToolbar({ editorRef, content, setContent, setIsDirty, projectType, onImageUpload }: EditorToolbarProps) {
  const insert = useCallback((before: string, after = '') => {
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = content.substring(s, e);
    const rep = before + (sel || 'text') + after;
    setContent(content.substring(0, s) + rep + content.substring(e));
    setIsDirty(true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length + (sel || 'text').length, s + before.length + (sel || 'text').length); }, 0);
  }, [content, editorRef, setContent, setIsDirty]);

  const mdxActions = [
    { icon: Bold, label: 'Bold', fn: () => insert('**', '**') },
    { icon: Italic, label: 'Italic', fn: () => insert('*', '*') },
    null,
    { icon: Heading1, label: 'H1', fn: () => insert('\n# ', '\n') },
    { icon: Heading2, label: 'H2', fn: () => insert('\n## ', '\n') },
    { icon: Heading3, label: 'H3', fn: () => insert('\n### ', '\n') },
    null,
    { icon: List, label: 'Bullets', fn: () => insert('\n- ', '\n') },
    { icon: ListOrdered, label: 'Numbers', fn: () => insert('\n1. ', '\n') },
    { icon: Quote, label: 'Quote', fn: () => insert('\n> ', '\n') },
    null,
    { icon: Code, label: 'Code', fn: () => insert('\n```\n', '\n```\n') },
    { icon: Link2, label: 'Link', fn: () => insert('[', '](url)') },
    { icon: Image, label: 'Image', fn: () => insert('![alt](', ')') },
    { icon: Minus, label: 'Divider', fn: () => insert('\n\n---\n\n', '') },
  ];

  const latexActions = [
    { icon: Bold, label: 'Bold', fn: () => insert('\\textbf{', '}') },
    { icon: Italic, label: 'Italic', fn: () => insert('\\textit{', '}') },
    null,
    { icon: Heading1, label: 'Section', fn: () => insert('\n\\section{', '}\n') },
    { icon: Heading2, label: 'Subsection', fn: () => insert('\n\\subsection{', '}\n') },
    { icon: Heading3, label: 'Subsubsection', fn: () => insert('\n\\subsubsection{', '}\n') },
    null,
    { icon: List, label: 'Itemize', fn: () => insert('\n\\begin{itemize}\n  \\item ', '\n\\end{itemize}\n') },
    { icon: ListOrdered, label: 'Enumerate', fn: () => insert('\n\\begin{enumerate}\n  \\item ', '\n\\end{enumerate}\n') },
    { icon: Quote, label: 'Quote', fn: () => insert('\n\\begin{quote}\n', '\n\\end{quote}\n') },
    null,
    { icon: Code, label: 'Verbatim', fn: () => insert('\n\\begin{verbatim}\n', '\n\\end{verbatim}\n') },
    { icon: Link2, label: 'URL', fn: () => insert('\\href{url}{', '}') },
    { icon: Image, label: 'Figure', fn: () => insert('\n\\begin{figure}[h]\n  \\includegraphics[width=\\textwidth]{', '}\n\\end{figure}\n') },
    { icon: Minus, label: 'Rule', fn: () => insert('\n\\hrule\n\n', '') },
  ];

  const actions = projectType === 'latex' ? latexActions : mdxActions;

  return (
    <div className="flex items-center gap-1 shrink-0 flex-wrap py-2">
      {/* Type badge */}
      <span className="text-xs font-bold px-2 py-1 rounded mr-3"
        style={{ background: projectType === 'latex' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: projectType === 'latex' ? '#60a5fa' : '#22c55e' }}>
        {projectType === 'latex' ? 'LaTeX' : 'MDX'}
      </span>

      {actions.map((item, i) => {
        if (!item) return <div key={`sep-${i}`} className="w-px h-6 mx-2" style={{ background: 'rgba(255,255,255,0.08)' }} />;
        const Icon = item.icon;
        return (
          <button key={i} onClick={item.fn} title={item.label}
            className="h-8 w-8 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-colors cursor-pointer">
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="w-px h-6 mx-2" style={{ background: 'rgba(255,255,255,0.08)' }} />

      <button onClick={onImageUpload} title="Upload Image"
        className="h-8 w-8 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-colors cursor-pointer">
        <Upload className="h-4 w-4" />
      </button>
    </div>
  );
}
