/**
 * Liquid Glass — a refracting surface, in Apple's sense of the term.
 *
 * The point of the effect is that it is *not* a blur. A blur averages what is
 * behind a pane; glass **bends** it. Look through a water droplet and the
 * background is displaced, magnified, and split into colour at the rim, while
 * the centre stays nearly clear. Everything below exists to reproduce those
 * four facts.
 *
 * ── How it works ────────────────────────────────────────────────────────
 *
 * CSS cannot bend a backdrop. But `backdrop-filter` accepts an SVG filter by
 * reference, and SVG can, so the whole effect is one filter graph applied to
 * whatever happens to be behind the element:
 *
 *   1. `feTurbulence` generates a smooth noise field. Its red and green
 *      channels are read as a vector per pixel — this is the shape of the
 *      "water", and it is what makes the distortion organic rather than a
 *      uniform lens.
 *
 *   2. That field is faded toward neutral in the middle by an elliptical
 *      ramp (**Splay**). Displacement is encoded as an offset from mid-grey,
 *      so "neutral" literally means 128 — blending toward it means *no
 *      displacement*. This is what keeps the centre readable and concentrates
 *      the warp at the border, the way thickness does in a real lens.
 *
 *   3. `feDisplacementMap` pushes each backdrop pixel by that vector
 *      (**Refraction**). Run once, this is plain refraction.
 *
 *   4. Run *three* times at slightly different strengths, and each pass is
 *      reduced to a single colour channel and recombined, the three channels
 *      land in slightly different places — which is exactly what dispersion
 *      is, and why the fringe it produces is a real rainbow rather than a
 *      drawn-on gradient (**Dispersion**).
 *
 *   5. `feGaussianBlur` softens the result (**Frost**).
 *
 * **Light** and **Depth** are not part of the filter: they are the specular
 * rim and the inner bevel, drawn in CSS, because they describe light falling
 * *on* the glass rather than passing through it.
 *
 * ── Support ─────────────────────────────────────────────────────────────
 *
 * `backdrop-filter: url(#id)` resolves in Chromium. Safari implements the
 * property but not the function, and Firefox neither. The component therefore
 * declares a plain blur first and only *adds* the filter where it resolves,
 * so the fallback is the material minus its lens rather than a bare
 * transparent box. Nothing here is required for the content to be legible.
 */

import { useId, type CSSProperties, type ReactNode } from 'react';

import { LIQUID_GLASS_DEFAULTS, type LiquidGlassSettings } from '@/lib/liquidGlass';
import { LiquidGlassFilter } from './LiquidGlassFilter';

/* ───────────────────────────── The component ───────────────────────────── */

export interface LiquidGlassProps {
  settings?: Partial<LiquidGlassSettings>;
  className?: string;
  style?: CSSProperties;
  /** Corner radius. Also drives the rim, which follows the same curve. */
  radius?: number | string;
  children?: ReactNode;
}

/**
 * A pane of liquid glass. Place it over content; it refracts what is behind.
 *
 * The filter id is generated per instance, so two panes with different
 * settings on one page do not collide — a single shared id would silently
 * give every pane the settings of whichever mounted last.
 */
export function LiquidGlass({
  settings, className, style, radius = 28, children,
}: LiquidGlassProps) {
  const resolved = { ...LIQUID_GLASS_DEFAULTS, ...settings };
  const { light, depth, frost } = resolved;
  const reactId = useId();
  // `useId` emits colons, which are not valid in a CSS url() fragment.
  const filterId = `liquid-glass-${reactId.replace(/:/g, '')}`;

  return (
    <>
      <svg aria-hidden="true" focusable="false" className="liquid-glass-defs">
        <defs><LiquidGlassFilter id={filterId} settings={resolved} /></defs>
      </svg>

      <div
        className={['liquid-glass-pane', className].filter(Boolean).join(' ')}
        style={{
          ...style,
          borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
          // Consumed by the stylesheet, so the rim and bevel scale with the
          // same numbers the filter uses and the two cannot disagree.
          ['--lg-light' as string]: String(light),
          ['--lg-depth' as string]: String(depth),
          ['--lg-frost' as string]: `${frost}px`,
          ['--lg-filter' as string]: `url(#${filterId})`,
        }}
      >
        {children}
      </div>
    </>
  );
}
