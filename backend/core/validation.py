"""Validation rules the browser and the server both have to agree on.

The browser enforces the same rules, in ``frontend/src/lib/validation.ts``.
Two languages means two copies; keeping each one small, and stating the rule as
a single sentence that both sides quote verbatim, is what stops them drifting
into two different-sounding rejections of the same input. Change one, change
the other — the file says so in both directions.
"""

from __future__ import annotations

import re

#: Usernames address a public profile at /u/<username>, so they must be URL-safe.
USERNAME_MIN = 3
USERNAME_MAX = 30
USERNAME_PATTERN = re.compile(rf"^[a-zA-Z0-9_-]{{{USERNAME_MIN},{USERNAME_MAX}}}$")

#: One sentence stating the whole rule, for whichever side rejects the input.
USERNAME_RULE = (
    f"Usernames are {USERNAME_MIN}–{USERNAME_MAX} characters, "
    "using letters, numbers, hyphen and underscore"
)

#: The longest bio a profile will store.
MAX_BIO_LENGTH = 280


def username_problem(username: str) -> str | None:
    """Why this username is unacceptable, or None if it is fine.

    Returns the specific problem rather than the whole rule, so the edit form
    can say "At least 3 characters" while the reader is still typing.
    """
    if not username:
        return None
    if len(username) < USERNAME_MIN:
        return f"At least {USERNAME_MIN} characters"
    if len(username) > USERNAME_MAX:
        return f"At most {USERNAME_MAX} characters"
    if not USERNAME_PATTERN.match(username):
        return "Letters, numbers, hyphen and underscore only"
    return None
