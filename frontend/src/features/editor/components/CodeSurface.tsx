import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { DocFormat } from '@/lib/types';
import { highlight } from '../lib/syntax';
import { lineAt, type Range } from '../lib/textOps';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelectionChange: () => void;
  onDropText: (text: string, clientX: number, clientY: number) => void;
  format: DocFormat;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  linesRef: React.RefObject<HTMLPreElement>;
  /** Search hits to mark, and which one is current. */
  finds?: Range[];
  activeFind?: number;
  showLineNumbers: boolean;
  focusMode: boolean;
  fontSize: number;
  caret: number;
  placeholder: string;
  /** Peer cursor layer. */
  children?: ReactNode;
}

/**
 * The editing surface: a real `<textarea>` over a syntax-highlighted mirror.
 *
 * Keeping the textarea means native undo, spellcheck, IME, autofill and screen
 * readers all still work — the things a hand-built contenteditable editor
 * spends years failing to reproduce. The mirror below it does nothing but
 * paint colour, so the two must share every metric that affects layout; that
 * is what `.code-text` in the stylesheet is for.
 */
export function CodeSurface({
  value, onChange, onKeyDown, onSelectionChange, onDropText, format,
  textareaRef, linesRef, finds = [], activeFind = -1,
  showLineNumbers, focusMode, fontSize, caret, placeholder, children,
}: Props) {
  const html = useMemo(
    () => highlight(value, format, finds, activeFind),
    [value, format, finds, activeFind],
  );

  // Scroll the mirror with the textarea. Layout effect so the two never paint
  // a frame out of alignment.
  const syncScroll = () => {
    const ta = textareaRef.current;
    const pre = linesRef.current;
    if (!ta || !pre) return;
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  };
  useLayoutEffect(syncScroll);

  // Focus mode dims everything but the line being written.
  const activeLine = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const pre = linesRef.current;
    if (!pre) return;
    activeLine.current?.classList.remove('cl-active');
    const index = lineAt(value, caret).number;
    const next = pre.children[index] as HTMLElement | undefined;
    next?.classList.add('cl-active');
    activeLine.current = next ?? null;
  }, [caret, value, html, linesRef]);

  return (
    <div
      className="code-surface"
      data-focus={focusMode}
      data-gutter={showLineNumbers}
      style={{ ['--code-size' as string]: `${fontSize}px` }}
    >
      <pre className="code-text code-mirror" ref={linesRef} aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: html }} />

      <textarea
        ref={textareaRef}
        className="code-text code-input"
        value={value}
        onChange={event => { onChange(event.target.value); onSelectionChange(); }}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        onSelect={onSelectionChange}
        onClick={onSelectionChange}
        onFocus={onSelectionChange}
        spellCheck
        placeholder={placeholder}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDrop={event => {
          const text = event.dataTransfer.getData('text/plain');
          if (!text) return;
          event.preventDefault();
          onDropText(text, event.clientX, event.clientY);
        }}
      />

      {children}
    </div>
  );
}
