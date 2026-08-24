"""Administrative commands: ``python -m backend.cli <command>``.

Small on purpose. These are the operations that have no place in the HTTP API
because no signed-in user should be able to perform them — setting somebody
else's password, and clearing out expired sessions.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from datetime import datetime, timezone

from sqlalchemy import delete, select

from .auth.passwords import hash_password, password_problem
from .db.models import AuthSession, User, new_user_id, normalize_email
from .db.session import session_factory


def _require_db():
    if session_factory is None:
        sys.exit("DATABASE_URL is not set.")
    return session_factory


async def set_password(email: str, password: str | None, *, create: bool) -> None:
    """Give an account a password.

    The path back in for accounts that predate in-house authentication: they
    carry a profile and their documents, but no password, so nothing can sign
    them in until this is run.
    """
    factory = _require_db()
    address = normalize_email(email)
    password = password or getpass.getpass(f"New password for {address}: ")

    problem = password_problem(password)
    if problem:
        sys.exit(problem)

    async with factory() as db:
        user = (
            await db.execute(select(User).where(User.email == address).limit(1))
        ).scalar_one_or_none()

        if user is None:
            if not create:
                sys.exit(f"No account with email {address}. Pass --create to make one.")
            user = User(id=new_user_id(), email=address)
            db.add(user)

        user.password_hash = hash_password(password)
        user.updated_at = datetime.utcnow()

        # Any session opened under the old password is no longer trustworthy.
        await db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        await db.commit()

    print(f"Password set for {address}.")


async def list_users() -> None:
    """Who exists, and whether they can sign in."""
    factory = _require_db()
    async with factory() as db:
        users = (await db.execute(select(User).order_by(User.created_at))).scalars().all()

    if not users:
        print("No accounts.")
        return

    print(f"{'email':40} {'username':20} password")
    for user in users:
        state = "set" if user.password_hash else "— cannot sign in"
        print(f"{user.email or '(none)':40} {user.username or '—':20} {state}")


async def prune_sessions() -> None:
    """Delete sessions that have already expired.

    Not required — expired sessions are dropped as they are encountered — but
    it keeps the table small on an installation with many lapsed logins.
    """
    factory = _require_db()
    async with factory() as db:
        result = await db.execute(
            delete(AuthSession).where(AuthSession.expires_at <= datetime.now(timezone.utc))
        )
        await db.commit()
    print(f"Removed {result.rowcount or 0} expired session(s).")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m backend.cli", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    set_pw = commands.add_parser("set-password", help="set or reset an account's password")
    set_pw.add_argument("email")
    set_pw.add_argument("--password", help="read from a prompt when omitted")
    set_pw.add_argument("--create", action="store_true", help="create the account if absent")

    commands.add_parser("list-users", help="list accounts and whether they can sign in")
    commands.add_parser("prune-sessions", help="delete expired sessions")

    args = parser.parse_args()

    if args.command == "set-password":
        asyncio.run(set_password(args.email, args.password, create=args.create))
    elif args.command == "list-users":
        asyncio.run(list_users())
    elif args.command == "prune-sessions":
        asyncio.run(prune_sessions())


if __name__ == "__main__":
    main()
