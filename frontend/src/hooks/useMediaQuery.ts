import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query currently matches.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the effect version
 * renders once with a guessed value and then corrects itself, which for a
 * layout decision means the wrong layout is mounted for a frame — and in the
 * editor's case means the preview pane and the collaborative cursor overlay
 * are built and thrown away on every load of a narrow window.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    callback => {
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    // Server/prerender: assume the roomy layout, which is the one the app was
    // designed against.
    () => false,
  );
}

/**
 * The width below which the editor cannot show two panes side by side.
 *
 * 900px is where it stops being a judgement call: the outline rail alone is
 * 280px by default, and splitting what is left puts the writing surface under
 * 300px — narrower than the measure the rendered half is trying to hold. Below
 * this the editor shows one pane at a time and the rail becomes a drawer over
 * the top rather than a column beside it.
 */
export const COMPACT_EDITOR = '(max-width: 899px)';

/** True when the editor should use its one-pane layout. */
export function useCompactEditor(): boolean {
  return useMediaQuery(COMPACT_EDITOR);
}
