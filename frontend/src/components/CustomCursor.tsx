import { useEffect, useRef } from 'react';

/**
 * A macOS-style pointer.
 *
 * The important thing about the system pointer is what it *doesn't* do: it
 * never lags behind the mouse, and it never animates its position. All the
 * motion is in the transitions between shapes — arrow to hand, present to
 * hidden — so that is where the animation budget goes here.
 *
 * Shapes follow the platform: the arrow's tip is its hotspot, the pointing
 * hand's fingertip is its own, and anything with a caret falls through to the
 * real I-beam, which no drawn copy would improve on.
 */

/** Things that take a caret — the native I-beam shows over these. */
const TEXT_SELECTOR = 'input, textarea, [contenteditable="true"], .code-surface';

/** Things that respond to a click — the hand shows over these. */
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], label, select, summary, [tabindex]:not([tabindex="-1"])';

/** macOS hides the pointer while you type, and brings it back on the first move. */
const HIDE_WHILE_TYPING = true;

type CursorState = 'idle' | 'interactive' | 'text';

export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = rootRef.current;
    if (!cursor) return;

    // A drawn pointer only makes sense where there is a real one to replace.
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const html = document.documentElement;
    html.classList.add('has-custom-cursor');

    let state: CursorState = 'idle';
    html.dataset.cursor = state;

    const setState = (next: CursorState) => {
      if (next === state) return;
      state = next;
      html.dataset.cursor = next;
    };

    const onMove = (event: MouseEvent) => {
      // No easing, no interpolation: the pointer is exactly where the mouse is.
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      html.dataset.cursorVisible = 'true';
      html.removeAttribute('data-cursor-typing');

      // One delegated hit-test per move, rather than listeners on every element
      // in the document — the editor rebuilds its DOM on each keystroke, and
      // rescanning it every time was pure overhead.
      const target = event.target as Element | null;
      if (!target?.closest) return;
      setState(
        target.closest(TEXT_SELECTOR) ? 'text'
          : target.closest(INTERACTIVE_SELECTOR) ? 'interactive'
            : 'idle',
      );
    };

    const onDown = () => html.setAttribute('data-cursor-down', 'true');
    const onUp = () => html.removeAttribute('data-cursor-down');
    const onLeave = () => { html.dataset.cursorVisible = 'false'; };
    const onEnter = () => { html.dataset.cursorVisible = 'true'; };

    const onKeyDown = (event: KeyboardEvent) => {
      // Only real typing hides it — not ⌘S, and not arrow keys.
      if (!HIDE_WHILE_TYPING || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') {
        html.setAttribute('data-cursor-typing', 'true');
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      html.classList.remove('has-custom-cursor');
      delete html.dataset.cursor;
      delete html.dataset.cursorVisible;
      html.removeAttribute('data-cursor-down');
      html.removeAttribute('data-cursor-typing');
    };
  }, []);

  return (
    <div ref={rootRef} className="cursor-mac" aria-hidden="true">
      {/* Arrow — hotspot is the tip, at the path's origin. */}
      <span className="cursor-shape cursor-shape--arrow">
        <svg width="15" height="22" viewBox="0 0 15 22" fill="none">
          <path
            d="M1.2 1.1 L1.2 17.4 L5.35 13.5 L8.15 19.9 L10.85 18.7 L8.1 12.5 L13.4 12.5 Z"
            className="cursor-fill"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Pointing hand — hotspot is the fingertip. */}
      <span className="cursor-shape cursor-shape--hand">
        <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
          <path
            d="M8.4 1.9c0-1 .8-1.7 1.7-1.7s1.7.8 1.7 1.7v7.4c.3-.5.8-.8 1.4-.8.9 0 1.7.8 1.7 1.7v.5c.3-.4.8-.7 1.4-.7.9 0 1.7.8 1.7 1.7v.8c.3-.3.7-.5 1.2-.5.9 0 1.7.8 1.7 1.7v3.8c0 3.1-2.5 5.6-5.6 5.6h-2.9c-1.6 0-3.1-.7-4.2-1.9l-5-5.6c-.6-.7-.6-1.8.1-2.4.7-.6 1.7-.6 2.4 0l2.7 2.5V1.9Z"
            className="cursor-fill"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
