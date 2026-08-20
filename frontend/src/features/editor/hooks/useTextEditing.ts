import { useCallback, useRef } from 'react';
import type { DocFormat } from '@/lib/types';
import {
  autoPair, continueBlock, indentLines, outdentLines, skipClosing,
  type EditResult, type Range,
} from '../lib/textOps';
import { actionForChord, type EditorAction } from '../lib/actions';

interface Options {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  content: string;
  setContent: (value: string) => void;
  format: DocFormat;
}

export interface TextEditing {
  /** Current selection, or the end of the document when unfocused. */
  selection: () => Range;
  /** Apply a pure edit and restore the caret it asks for. */
  apply: (result: EditResult) => void;
  run: (action: EditorAction) => void;
  /** Keydown handler for the editing surface. */
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * The bridge between pure text operations and a live textarea.
 *
 * React controls the value, so every edit has to re-assert the caret after the
 * re-render — doing that in one place is what lets the toolbar, shortcuts,
 * slash menu and AI panel all share the same operations.
 */
export function useTextEditing({ textareaRef, content, setContent, format }: Options): TextEditing {
  const pendingCaret = useRef<Range | null>(null);

  const selection = useCallback((): Range => {
    const ta = textareaRef.current;
    if (!ta) return { start: content.length, end: content.length };
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }, [content.length, textareaRef]);

  const apply = useCallback((result: EditResult) => {
    setContent(result.content);
    pendingCaret.current = { start: result.start, end: result.end };
    // The value lands on the next paint; restore the caret right after it.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      const caret = pendingCaret.current;
      if (!ta || !caret) return;
      ta.focus();
      ta.setSelectionRange(caret.start, caret.end);
      pendingCaret.current = null;
    });
  }, [setContent, textareaRef]);

  const run = useCallback((action: EditorAction) => {
    apply(action.apply(content, selection()));
  }, [apply, content, selection]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const sel = { start: ta.selectionStart, end: ta.selectionEnd };
    const mod = event.metaKey || event.ctrlKey;

    // ⌘B / ⌘I / ⌘K / ⌘1… — whatever the format's registry binds.
    if (mod && !event.altKey) {
      const action = actionForChord(format, event.key, event.shiftKey);
      if (action) {
        event.preventDefault();
        apply(action.apply(content, sel));
        return;
      }
    }
    if (mod) return; // leave ⌘S, ⌘Z, ⌘F and friends to their owners

    if (event.key === 'Tab') {
      event.preventDefault();
      apply(event.shiftKey ? outdentLines(content, sel) : indentLines(content, sel));
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const result = continueBlock(content, sel.start, format);
      if (result) {
        event.preventDefault();
        apply(result);
      }
      return;
    }

    if (event.key.length === 1) {
      if (skipClosing(content, sel, event.key)) {
        event.preventDefault();
        ta.setSelectionRange(sel.start + 1, sel.start + 1);
        return;
      }
      const paired = autoPair(content, sel, event.key);
      if (paired) {
        event.preventDefault();
        apply(paired);
      }
    }
  }, [apply, content, format, textareaRef]);

  return { selection, apply, run, onKeyDown };
}
