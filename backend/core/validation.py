"""Validation rules the browser and the server both have to agree on.

The browser enforces the same rules, in ``frontend/src/lib/validation.ts``.
Two languages means two copies, and keeping each one small is what stops them
drifting into two different-sounding rejections of the same input. Change one,
change the other — the file says so in both directions.

The two sides do not carry identical code, only identical limits. The server
rejects with the whole rule in one sentence (``USERNAME_RULE``); the browser
names the one thing wrong with what has been typed so far, which is the useful
thing to say while someone is still typing.
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
