/**
 * Small request-level helpers shared by the route modules.
 *
 * Each of these existed in more than one file — `idParam` in two, with the
 * second copy using `parseInt` and an `isNaN` check that let `/lessonPlans/1x`
 * through as id 1.
 */

/**
 * A positive integer route parameter, or null.
 *
 * `Number("abc")` is NaN, and handing NaN to Postgres for an integer column
 * raises rather than matching nothing — so an unguarded `/posts/abc` answered
 * 500 where it should answer 400. `Number` rather than `parseInt`, because
 * `parseInt("12abc")` is 12 and a URL that is not a number should not resolve
 * to a document.
 */
export function idParam(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Display name for an author: given name, else email handle, else "Member". */
export function authorName(user: { given_name?: string; email?: string }): string {
  return user.given_name?.trim() || user.email?.split("@")[0] || "Member";
}
