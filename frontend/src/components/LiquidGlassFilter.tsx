/**
 * The Liquid Glass filter graph — the single implementation of the effect.
 *
 * Lives on its own because two things need it and they must not drift: the
 * `LiquidGlass` pane component, and the small set of named presets in
 * `GlassFilters` that the navigation bar and the buttons reference by id from
 * CSS. A second copy is how one of them ends up with dispersion and the other
 * without, and nobody notices for a month.
 *
 * See `LiquidGlass.tsx` for what each stage does and why.
 */

import type { LiquidGlassSettings } from '@/lib/liquidGlass';

/**
 * The elliptical ramp that keeps the centre of the pane clear.
 *
 * Black at the centre, white at the rim. Fed to an arithmetic composite it
 * becomes the interpolation factor between "no displacement" and "full
 * turbulence", which is the whole of Splay.
 *
 * **This string is a constant, and must stay one.** It was originally built
 * from the Splay setting, which meant every drag of that slider handed
 * `feImage` a new URL to fetch. Until the fetch resolves `feImage` yields
 * nothing, and an arithmetic composite against nothing collapses to the
 * constant k4 — a uniform neutral field, which is precisely "no
 * displacement". Dragging Splay therefore turned the entire effect off, and
 * it did not come back.
 *
 * So the ramp is fixed and loaded once, and Splay reshapes it with
 * `feComponentTransfer` instead, which is a pure computation on pixels that
 * are already in hand.
 */
const SPLAY_RAMP =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>" +
  "<defs><radialGradient id='r' cx='0.5' cy='0.5' r='0.5'>" +
  "<stop offset='0' stop-color='rgb(0,0,0)'/>" +
  "<stop offset='1' stop-color='rgb(255,255,255)'/>" +
  "</radialGradient></defs>" +
  "<rect width='100' height='100' fill='url(%23r)'/></svg>";

/** Keeps only one channel of a pass, so three passes can be recombined. */
const CHANNEL_MATRIX: Record<'r' | 'g' | 'b', string> = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
};

export function LiquidGlassFilter({
  id, settings, frequency = 0.01,
}: {
  id: string;
  settings: LiquidGlassSettings;
  /**
   * Noise scale, in cycles per pixel. This has to track the size of the thing
   * being filtered, and it is the setting most easily got wrong.
   *
   * At 0.008 a noise feature spans ~125px. On a 500px sheet that is a handful
   * of ripples; on a 36px button it is larger than the button, so every pixel
   * gets almost the same offset and the result is a uniform *shift* rather
   * than a warp — the effect silently disappears at small sizes. Small chrome
   * therefore needs a higher frequency to have any structure inside its own
   * border.
   */
  frequency?: number;
}) {
  const { refraction, dispersion, frost, splay } = settings;

  // The three passes straddle the base strength. Longer wavelengths bend less
  // in real glass, so red is displaced least and blue most — getting this the
  // right way round is the difference between a fringe that looks optical and
  // one that looks like a rendering fault.
  const spread = refraction * dispersion * 0.5;
  const scales = { r: refraction - spread, g: refraction, b: refraction + spread };

  return (
    <filter
      id={id}
      x="0%" y="0%" width="100%" height="100%"
      colorInterpolationFilters="sRGB"
    >
      {/* 1. The water. `fractalNoise` rather than `turbulence` because the
             latter's absolute value creates hard creases that read as cracks. */}
      <feTurbulence
        type="fractalNoise"
        baseFrequency={`${frequency} ${frequency * 1.5}`}
        numOctaves={2}
        seed={7}
        result="noise"
      />

      {/* 2. The falloff ramp, stretched to the element, then bent by Splay.
             A gamma curve on a 0→1 ramp moves where it starts to rise: at
             exponent 1 the whole face is affected, and the higher it goes the
             harder the ramp is pushed toward the rim. */}
      <feImage preserveAspectRatio="none" href={SPLAY_RAMP} result="rawRamp" />
      <feComponentTransfer in="rawRamp" result="ramp">
        <feFuncR type="gamma" exponent={1 + splay * 14} />
        <feFuncG type="gamma" exponent={1 + splay * 14} />
        <feFuncB type="gamma" exponent={1 + splay * 14} />
      </feComponentTransfer>

      {/* Fade the noise toward neutral grey wherever the ramp is dark:
             out = noise·ramp − 0.502·ramp + 0.502
          which is a linear interpolation from 0.502 (no displacement) at the
          centre to the raw noise at the rim. */}
      <feComposite
        in="noise" in2="ramp" operator="arithmetic"
        k1={1} k2={0} k3={-0.502} k4={0.502}
        result="field"
      />

      {/* 3 & 4. One displacement pass per channel. */}
      {(['r', 'g', 'b'] as const).map(channel => (
        <feDisplacementMap
          key={channel}
          in="SourceGraphic" in2="field"
          scale={scales[channel]}
          xChannelSelector="R" yChannelSelector="G"
          result={`pass-${channel}`}
        />
      ))}

      {(['r', 'g', 'b'] as const).map(channel => (
        <feColorMatrix
          key={channel}
          in={`pass-${channel}`} type="matrix" values={CHANNEL_MATRIX[channel]}
          result={`only-${channel}`}
        />
      ))}

      {/* Screen is additive for these — each input holds exactly one channel,
          so the three sum back to a full-colour image with the channels
          landing in three slightly different places. */}
      <feBlend in="only-r" in2="only-g" mode="screen" result="rg" />
      <feBlend in="rg" in2="only-b" mode="screen" result="rgb" />

      {/* 5. Frost, last, so it softens the bend rather than the bend
             smearing an already-blurred image. */}
      {frost > 0
        ? <feGaussianBlur in="rgb" stdDeviation={frost} />
        : <feOffset in="rgb" dx={0} dy={0} />}
    </filter>
  );
}

