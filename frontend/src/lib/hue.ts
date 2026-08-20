/**
 * Stable hue (0–359) derived from any identifier.
 *
 * Used to tint avatars and profile banners so accounts are visually
 * distinguishable even when nobody has uploaded a picture. Deterministic, so
 * the same person is the same colour on every screen and every session.
 */
export function hueFor(seed: string | null | undefined): number {
  const s = seed || "topical";
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
