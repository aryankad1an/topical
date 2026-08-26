import { useEffect, useRef } from 'react';

/**
 * Closes a popover when the pointer goes anywhere else.
 *
 * The returned ref must wrap every trigger as well as the menus themselves —
 * a trigger left outside it gets its menu closed on mousedown and reopened on
 * click, so it can never toggle off.
 *
 * Escape closes it too: a popover a mouse can dismiss and a keyboard cannot is
 * a trap for anyone not using a pointer.
 *
 * Lived inside `EditorHeader` until the collaborator list needed the same
 * behaviour on three other screens.
 */
export function useDismiss<T extends HTMLElement = HTMLDivElement>(onDismiss: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);
  return ref;
}
