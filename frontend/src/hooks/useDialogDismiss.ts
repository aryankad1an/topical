import { useEffect } from 'react';

/**
 * Escape closes, and the page behind stops scrolling.
 *
 * Both community dialogs were dismissable only by the X or by hitting the
 * backdrop. Escape is not a power-user shortcut on a modal — it is the way
 * most people close one, and the only way somebody navigating by keyboard
 * can. Behind them the page also kept scrolling: flick the wheel over a post
 * and the list underneath moved instead, which reads as the dialog having
 * come loose from the page.
 *
 * The scroll lock compensates for the scrollbar's width. Without that, hiding
 * the page's scrollbar widens the viewport by ~15px and everything behind the
 * scrim jumps sideways at the moment the dialog opens — including the fixed
 * nav, which is the one thing on screen the eye is using as an anchor.
 */
export function useDialogDismiss(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const overflow = body.style.overflow;
    const padding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padding;
    };
  }, []);
}
