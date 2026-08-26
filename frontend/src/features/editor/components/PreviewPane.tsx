import { forwardRef } from 'react';
import { Eye } from 'lucide-react';
import { renderedPrefixAt } from '@/features/editor/lib/sourceAlign';
import type { DocFormat } from '@/lib/types';
import { MarkdownPreview } from '@/features/preview/MarkdownPreview';
import { LatexPreview } from '@/features/preview/LatexPreview';

interface Props {
  content: string;
  format: DocFormat;
  /**
   * Whether a writing surface exists alongside this one.
   *
   * Changes what an empty document says, and whether LaTeX warnings are worth
   * showing — both are addressed to whoever can act on them.
   */
  editing: boolean;
  /**
   * The writer's chosen text size, in px — the same number that sizes the
   * source textarea's `--code-size`. Scaled here against `DEFAULT_OPTIONS`'s
   * 16px baseline into a multiplier the stylesheet applies to the rendered
   * type. Optional so a caller with no size preference (there is none today,
   * but nothing here should require one) gets the unscaled default.
   */
  fontSize?: number;
  /**
   * Clicking the rendered document puts the caret on the character that
   * produced whatever was clicked.
   *
   * `line` is the block's first line, from `data-line`; `prefix` is the
   * block's visible text up to the click. The caller owns the source, so it
   * does the aligning — see `lib/sourceAlign`.
   *
   * Only meaningful with a source pane in view — the caller passes this in
   * split mode and leaves it out everywhere else, including the full-screen
   * preview inside an editing session, where there is no pane to see the
   * caret land in.
   */
  onJumpToSource?: (line: number, prefix: string) => void;
}

/** `viewOptions.ts`'s `DEFAULT_OPTIONS.fontSize` — the size the scale is 1 at. */
const BASE_FONT_SIZE = 16;

/** The rendered half of the editor — and, on its own, the reading view. */
export const PreviewPane = forwardRef<HTMLDivElement, Props>(function PreviewPane(
  { content, format, editing, fontSize, onJumpToSource }, ref,
) {
  return (
    <div
      className="doc-preview"
      ref={ref}
      /*
       * A single click, not a double one — split mode is two views of the
       * same document read against each other, and the point of that is to
       * click a word on the right and land on that word on the left, the way
       * a PDF viewer's outline jumps the page rather than asking you to
       * double-click it.
       *
       * Gated on the selection being empty: a click that ends a drag-select
       * still fires as a click, and jumping the caret out from under someone
       * mid-copy would fight the one thing they were doing with the mouse.
       */
      onClick={event => {
        if (!onJumpToSource) return;
        if (window.getSelection()?.toString()) return;
        const block = (event.target as HTMLElement).closest<HTMLElement>('[data-line]');
        if (!block?.dataset.line) return;
        onJumpToSource(
          Number(block.dataset.line) - 1,
          renderedPrefixAt(block, event.clientX, event.clientY),
        );
      }}
    >
      {content.trim() ? (
        <div
          className="doc-sheet"
          data-format={format}
          style={fontSize ? { ['--doc-font-scale' as string]: fontSize / BASE_FONT_SIZE } : undefined}
        >
          {/* Unresolved references and malformed environments are a writing
              problem. Someone reading the document can do nothing about them,
              and a panel of them above the prose is the first thing they see. */}
          {format === 'latex'
            ? <LatexPreview content={content} showIssues={editing} />
            : <MarkdownPreview content={content} trackSource />}
        </div>
      ) : editing ? (
        <div className="doc-empty">
          <Eye className="h-7 w-7" />
          <p>Your document appears here as you write.</p>
          <p className="doc-empty-sub">
            {format === 'latex'
              ? 'Sections, equations and references are numbered live.'
              : 'Markdown, tables, code and $maths$ all render as you type.'}
          </p>
        </div>
      ) : (
        <div className="doc-empty">
          <Eye className="h-7 w-7" />
          <p>This document is empty.</p>
          <p className="doc-empty-sub">Nothing has been written in it yet.</p>
        </div>
      )}
    </div>
  );
});
