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

/**
 * How long ago, coarsely: "just now", "5m ago", "3h ago", "2d ago".
 *
 * For timestamps a reader is scanning rather than reading — post and comment
 * bylines — where "how recent" is the whole question and the exact date is
 * noise. Both community surfaces carried their own copy of this, and they had
 * already drifted apart in the day/hour branch.
 */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
