/**
 * The wordmark, in one place.
 *
 * It was written out three times in the root route — desktop nav, mobile bar,
 * mobile menu — as inline styles, each with its own tile size, its own font
 * weight and its own idea of what the "T" was set in. `fontFamily: 'inherit'`
 * put the tile's letter in the interface sans while the word beside it was in
 * the serif, so the mark and the name were in two different voices at 22px
 * apart.
 */
export function BrandMark({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const tile = size === 'sm' ? 22 : 24;
  return (
    <span className="brand-lockup">
      <span className="brand-tile" style={{ width: tile, height: tile }} aria-hidden="true">T</span>
      <span className="font-brand brand-word">Topical</span>
    </span>
  );
}
