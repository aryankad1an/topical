import { useCallback, useEffect, useRef } from 'react';

interface Options {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** The highlight overlay, whose per-line divs give an exact line→pixel map. */
  linesRef: React.RefObject<HTMLElement>;
  previewRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  /** Bumping this re-measures after the document changes. */
  revision: unknown;
}

/**
 * Keep the two panes showing the same part of the document.
 *
 * Proportional scrolling looks right only until a code block or an equation
 * makes one side taller than the other. The preview tags its blocks with the
 * source line they came from, and the highlight overlay has one element per
 * line, so both sides can be measured in the same units — lines — and mapped
 * to each other exactly.
 */
export function useScrollSync({ textareaRef, linesRef, previewRef, enabled, revision }: Options) {
  // Whichever pane the pointer last touched drives; the other follows without
  // echoing the scroll back.
  const driver = useRef<'editor' | 'preview' | null>(null);
  const release = useRef<number | undefined>(undefined);

  const lineTops = useRef<number[]>([]);
  const anchors = useRef<{ line: number; top: number }[]>([]);

  const measure = useCallback(() => {
    const lines = linesRef.current;
    lineTops.current = lines
      ? Array.from(lines.children).map(child => (child as HTMLElement).offsetTop)
      : [];

    const preview = previewRef.current;
    anchors.current = preview
      ? Array.from(preview.querySelectorAll<HTMLElement>('[data-line]'))
          .map(el => ({ line: Number(el.dataset.line) - 1, top: el.offsetTop }))
          .filter(a => Number.isFinite(a.line))
          .sort((a, b) => a.line - b.line)
      : [];
  }, [linesRef, previewRef]);

  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [enabled, measure, revision]);

  useEffect(() => {
    if (!enabled) return;
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const take = (who: 'editor' | 'preview') => {
      driver.current = who;
      window.clearTimeout(release.current);
      release.current = window.setTimeout(() => { driver.current = null; }, 120);
    };

    const fraction = (el: HTMLElement) => {
      const range = el.scrollHeight - el.clientHeight;
      return range > 0 ? el.scrollTop / range : 0;
    };

    const onEditorScroll = () => {
      if (driver.current === 'preview') return;
      take('editor');
      const line = lineAtOffset(lineTops.current, editor.scrollTop);
      const top = line === null ? fraction(editor) * (preview.scrollHeight - preview.clientHeight)
        : previewOffsetForLine(anchors.current, line);
      if (top !== null) preview.scrollTop = top;
    };

    const onPreviewScroll = () => {
      if (driver.current === 'editor') return;
      take('preview');
      const line = lineAtPreviewOffset(anchors.current, preview.scrollTop);
      const top = line === null ? fraction(preview) * (editor.scrollHeight - editor.clientHeight)
        : lineTops.current[Math.min(line, lineTops.current.length - 1)];
      if (top !== undefined && top !== null) editor.scrollTop = top;
    };

    editor.addEventListener('scroll', onEditorScroll, { passive: true });
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });
    return () => {
      editor.removeEventListener('scroll', onEditorScroll);
      preview.removeEventListener('scroll', onPreviewScroll);
    };
  }, [enabled, previewRef, textareaRef]);
}

/** The last line whose top is at or above `offset`. */
function lineAtOffset(tops: number[], offset: number): number | null {
  if (!tops.length) return null;
  let low = 0;
  let high = tops.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (tops[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Interpolate between the preview blocks that bracket a source line. */
function previewOffsetForLine(anchors: { line: number; top: number }[], line: number): number | null {
  if (!anchors.length) return null;
  if (line <= anchors[0].line) return anchors[0].top;

  for (let i = 0; i < anchors.length - 1; i++) {
    const current = anchors[i];
    const next = anchors[i + 1];
    if (line >= current.line && line <= next.line) {
      const span = next.line - current.line || 1;
      const progress = (line - current.line) / span;
      return current.top + progress * (next.top - current.top);
    }
  }
  return anchors[anchors.length - 1].top;
}

function lineAtPreviewOffset(anchors: { line: number; top: number }[], offset: number): number | null {
  if (!anchors.length) return null;
  let found = anchors[0].line;
  for (const anchor of anchors) {
    if (anchor.top > offset) break;
    found = anchor.line;
  }
  return found;
}
