/**
 * The Liquid Glass material's settings.
 *
 * Split out of the component so that file exports only components — a module
 * that mixes the two loses React Fast Refresh, which for a control panel you
 * are actively dragging sliders on is exactly the wrong thing to lose.
 */

export interface LiquidGlassSettings {
  /** Specular rim brightness, 0–1. Light falling on the surface. */
  light: number;
  /** Displacement strength in pixels. The bend itself. */
  refraction: number;
  /** Inner bevel strength, 0–1. How thick the pane reads. */
  depth: number;
  /** RGB split, 0–1. The rainbow fringe at the rim. */
  dispersion: number;
  /** Backdrop blur in pixels, applied after the bend. */
  frost: number;
  /**
   * Edge falloff, 0–1. Where the distortion band begins, as a fraction of
   * the half-diagonal: 0 warps the whole face, 0.9 only the outermost rim.
   */
  splay: number;
}

export const LIQUID_GLASS_DEFAULTS: LiquidGlassSettings = {
  light: 0.55,
  refraction: 18,
  depth: 0.5,
  dispersion: 0.35,
  frost: 3,
  splay: 0.45,
};

/** The tunable range of each setting, for a controls panel to read. */
export const LIQUID_GLASS_RANGES: Record<keyof LiquidGlassSettings, {
  min: number; max: number; step: number; label: string; hint: string;
}> = {
  light:      { min: 0, max: 1,  step: 0.01, label: 'Light',      hint: 'Specular rim' },
  refraction: { min: 0, max: 80, step: 1,    label: 'Refraction', hint: 'How far the backdrop bends' },
  depth:      { min: 0, max: 1,  step: 0.01, label: 'Depth',      hint: 'Inner bevel — apparent thickness' },
  dispersion: { min: 0, max: 1,  step: 0.01, label: 'Dispersion', hint: 'Chromatic split at the edge' },
  frost:      { min: 0, max: 24, step: 0.5,  label: 'Frost',      hint: 'Blur applied after the bend' },
  splay:      { min: 0, max: 0.95, step: 0.01, label: 'Splay',    hint: 'Where the distortion band starts' },
};

