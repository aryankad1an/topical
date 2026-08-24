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

/* ─────────────────────────── Strength ───────────────────────────
   Advice, not a rule. The server accepts anything eight characters or
   longer, and this must never disagree with it — a meter that blocks
   submission is a second, undocumented password policy, and the one place
   it will be discovered is by someone who cannot sign up.

   So this scores and says so, and nothing here gates the button. */

export type PasswordStrength = {
  /** 0–4. 0 means "nothing typed yet". */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** The cheapest single change that would raise the score. */
  advice: string | null;
};

/**
 * A rough score for a password, from length and character variety.
 *
 * Length is weighted above variety on purpose: `correcthorsebattery` resists
 * guessing far better than `P@ss1!`, and a meter that says otherwise teaches
 * people to write the short one.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', advice: null };

  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));

  let points = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (classes >= 2) points += 1;
  if (classes >= 3) points += 1;

  // A single repeated character or a straight run of digits is long without
  // being hard to guess; length alone must not carry those to the top.
  if (/^(.)\1+$/.test(password) || /^\d+$/.test(password)) points = Math.min(points, 1);

  const score = Math.min(4, Math.max(1, points)) as 1 | 2 | 3 | 4;
  const label = (['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const)[score];

  let advice: string | null = null;
  if (password.length < MIN_PASSWORD_LENGTH) advice = PASSWORD_RULE;
  else if (password.length < 12) advice = 'Longer is stronger — try a short phrase';
  else if (classes < 2) advice = 'Mix in a capital or a number';

  return { score, label, advice };
}
