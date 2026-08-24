/**
 * Presentation helpers for values that appear on more than one screen.
 *
 * Dates in particular were being formatted at five call sites with four
 * different option objects, so the same document showed "Aug 24, 2026" in the
 * workspace and "August 2026" on a profile for no reason anybody chose.
 */

/** A full date: "24 Aug 2026". Empty string for a missing date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Month and year only: "August 2026" — for "joined" and other coarse dates. */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
