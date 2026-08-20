import { forwardRef } from 'react';
import { Eye } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import { MarkdownPreview } from '@/features/preview/MarkdownPreview';
import { LatexPreview } from '@/features/preview/LatexPreview';

interface Props {
  content: string;
  format: DocFormat;
  /** Clicking a rendered block puts the caret on the line that produced it. */
  onJumpToLine?: (line: number) => void;
}

/** The rendered half of the editor. */
export const PreviewPane = forwardRef<HTMLDivElement, Props>(function PreviewPane(
  { content, format, onJumpToLine }, ref,
) {
  return (
    <div
      className="doc-preview"
      ref={ref}
      onDoubleClick={event => {
        if (!onJumpToLine) return;
        const block = (event.target as HTMLElement).closest<HTMLElement>('[data-line]');
        if (block?.dataset.line) onJumpToLine(Number(block.dataset.line) - 1);
      }}
    >
      {content.trim() ? (
        <div className="doc-sheet" data-format={format}>
          {format === 'latex'
            ? <LatexPreview content={content} />
            : <MarkdownPreview content={content} trackSource />}
        </div>
      ) : (
        <div className="doc-empty">
          <Eye className="h-7 w-7" />
          <p>Your document appears here as you write.</p>
          <p className="doc-empty-sub">
            {format === 'latex'
              ? 'Sections, equations and references are numbered live.'
              : 'Markdown, tables, code and $maths$ all render as you type.'}
          </p>
        </div>
      )}
    </div>
  );
});
