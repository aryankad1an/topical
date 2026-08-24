/**
 * Validation rules the browser and the server both have to agree on.
 *
 * The server enforces the same rules, in `backend/core/validation.py`. Two
 * languages means two copies; keeping each one small, and stating the rule as
 * a single sentence that both sides quote verbatim, is what stops them
 * drifting into two different-sounding rejections of the same input. Change
 * one, change the other — the file says so in both directions.
 */

/** Usernames address a public profile at /u/<username>, so they must be URL-safe. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

/** One sentence stating the whole rule, for whichever side rejects the input. */
export const USERNAME_RULE =
  `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} characters, using letters, numbers, hyphen and underscore`;

/** The longest bio a profile will store. */
export const MAX_BIO_LENGTH = 280;

/** Passwords: the same floor `backend/auth/passwords.py` enforces. */
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_RULE = `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters`;

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

/** Why this password is unacceptable, or null if it is fine. */
export function passwordProblem(password: string): string | null {
  if (!password) return null;
  if (password.length < MIN_PASSWORD_LENGTH) return PASSWORD_RULE;
  return null;
}
