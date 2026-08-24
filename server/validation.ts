/**
 * Validation rules the browser and the server both have to agree on.
 *
 * Deliberately free of imports — no Hono, no drizzle, no database — because
 * the frontend imports this file directly through its `@server` alias. Putting
 * these next to the route handlers would drag the whole server into the
 * browser bundle; writing them out twice is what produced the drift this
 * replaces, where the edit form and the PATCH handler enforced the same rule
 * in two places and reported it in two different sentences.
 */

/** Usernames address a public profile at /u/<username>, so they must be URL-safe. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** One sentence stating the whole rule, for whichever side rejects the input. */
export const USERNAME_RULE =
  `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} characters, using letters, numbers, hyphen and underscore`;

/** The longest bio a profile will store. */
export const MAX_BIO_LENGTH = 280;

/**
 * Why this username is unacceptable, or null if it is fine.
 *
 * Returns the specific problem rather than the whole rule, so the edit form
 * can say "At least 3 characters" while the reader is still typing.
 */
export function usernameProblem(username: string): string | null {
  if (!username) return null;
  if (username.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters`;
  if (username.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(username)) return "Letters, numbers, hyphen and underscore only";
  return null;
}
