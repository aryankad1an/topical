import { LiquidGlassFilter } from './LiquidGlassFilter';
import type { LiquidGlassSettings } from '@/lib/liquidGlass';

/**
 * The named Liquid Glass filters the interface references from CSS.
 *
 * Rendered once from the root shell. `backdrop-filter: url(#id)` resolves
 * against the document, so one copy of each serves every element that names
 * it — which matters, because these are not cheap: each is a turbulence pass,
 * three displacement passes, and a recombine.
 *
 * ── Why presets rather than one filter ──────────────────────────────────
 *
 * Refraction is an absolute pixel offset and the noise has an absolute scale,
 * so neither survives being applied at a size it was not tuned for. A 22px
 * displacement inside a 34px-tall navigation pill does not bend its backdrop,
 * it destroys it; and noise coarse enough to ripple across a sheet is larger
 * than a button, which turns the warp into a plain shift.
 *
 * Each preset is therefore tuned to the height of the thing it dresses:
 * displacement stays a small fraction of that height, the noise is fine
 * enough to have structure inside it, and Splay is pushed further out the
 * smaller the element gets — on a 34px pill there is no "centre" to spare, so
 * the clear zone has to be most of it or the label starts to swim.
 */

/** Sheets, dialogs, the command palette — room to bend properly. */
const PANEL: LiquidGlassSettings = {
  light: 0.5, refraction: 18, depth: 0.5, dispersion: 0.4, frost: 14, splay: 0.4,
};

/** The floating navigation pill: ~44px tall, over scrolling page content. */
const NAV: LiquidGlassSettings = {
  light: 0.55, refraction: 7, depth: 0.5, dispersion: 0.55, frost: 7, splay: 0.5,
};

/** Buttons, chips and toolbar controls: 28–40px, and there are many of them. */
const BUTTON: LiquidGlassSettings = {
  light: 0.5, refraction: 4, depth: 0.4, dispersion: 0.6, frost: 5, splay: 0.55,
};

export function GlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <LiquidGlassFilter id="lg-panel" settings={PANEL} frequency={0.009} />
        {/* Finer noise as the elements get smaller — see the `frequency` note
            on LiquidGlassFilter. */}
        <LiquidGlassFilter id="lg-nav" settings={NAV} frequency={0.03} />
        <LiquidGlassFilter id="lg-button" settings={BUTTON} frequency={0.055} />
      </defs>
    </svg>
  );
}
