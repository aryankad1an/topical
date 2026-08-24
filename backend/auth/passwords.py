"""Password hashing, and the one rule about what a password may be.

Argon2id, with argon2-cffi's defaults: it is the algorithm the Password
Hashing Competition selected, and unlike a bare SHA it is deliberately slow and
memory-hard, which is the only property that matters if the table ever leaks.

The hash carries its own parameters, so ``needs_rehash`` can tell an old hash
from a current one and the login path can quietly upgrade it — raising the cost
later is then a one-line change here rather than a forced reset for everyone.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

#: Stated once, and quoted verbatim by the API when it rejects a password.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 200
PASSWORD_RULE = f"Passwords must be at least {MIN_PASSWORD_LENGTH} characters"

_hasher = PasswordHasher()


def password_problem(password: str) -> str | None:
    """Why this password is unacceptable, or None if it is fine.

    An upper bound as well as a lower one: argon2 is memory-hard by design, so
    an unbounded password is an unbounded amount of work for one unauthenticated
    request.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        return PASSWORD_RULE
    if len(password) > MAX_PASSWORD_LENGTH:
        return f"Passwords must be at most {MAX_PASSWORD_LENGTH} characters"
    return None


def hash_password(password: str) -> str:
    """The stored form of a password. Never reversible, and salted per call."""
    return _hasher.hash(password)


def verify_password(stored_hash: str | None, password: str) -> bool:
    """Whether ``password`` is the one behind ``stored_hash``.

    False rather than an exception for every failure mode, including a row
    that has no password at all — the caller is a login handler, and every
    one of these cases is the same answer to the user.
    """
    if not stored_hash:
        return False
    try:
        return _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    """Whether this hash predates the current cost parameters."""
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True
