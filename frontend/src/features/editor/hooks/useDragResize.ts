import { useCallback, useRef } from 'react';

interface Options {
  /** The value the drag starts from, read when the pointer goes down. */
  from: () => number;
  /** Turn horizontal pointer travel into the next value. */
  to: (deltaX: number, start: number) => number;
  onChange: (value: number) => void;
}

/**
 * A horizontal drag handle: pointer-down to start, pointer-up to stop.
 *
 * Both draggable edges of the editor — the outline rail's border and the
 * split-pane divider — need the same listener bookkeeping, and getting it
 * subtly wrong leaves a `mousemove` handler attached to the document for the
 * rest of the session. They differ only in what a pixel of travel means, which
 * is the one thing `to` decides.
 */
export function useDragResize(options: Options) {
  // Read through a ref so the handler is stable while the callbacks it needs
  // stay current — they close over state that changes on every drag frame.
  const latest = useRef(options);
  latest.current = options;

  return useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const start = latest.current.from();

    const onMove = (move: MouseEvent) => {
      const { to, onChange } = latest.current;
      onChange(to(move.clientX - startX, start));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);
}
