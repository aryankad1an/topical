/**
 * The Liquid Glass material's settings.
 *
 * Shared by `LiquidGlassFilter`, which builds one SVG filter from a settings
 * object, and by `GlassFilters`, which names the three presets the interface
 * references from CSS. A type rather than a component, so importing it does
 * not drag a component module into a file that only needs the shape.
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
