"""In-house authentication: password hashes, and server-side sessions.

Adds what this application needs to be its own identity provider. Existing
rows keep working as profiles and authors; they simply have no password until
one is set, and ``authenticate`` treats that as bad credentials rather than as
a way in.

Revision ID: 0002_in_house_auth
Revises: 0001_baseline
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_in_house_auth"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))

    # Email is the login handle, so one address must mean one account. Rows are
    # normalised to lower case first: without it, two accounts differing only
    # in capitalisation would both survive the index and both match a login.
    op.execute("UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL")
    op.create_index("users_email_unique_idx", "users", ["email"], unique=True)

    op.create_table(
        "auth_sessions",
        # The sha256 of the cookie token — never the token itself, so a leaked
        # database yields no usable sessions.
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
    )
    op.create_index("auth_sessions_user_id_idx", "auth_sessions", ["user_id"])
    op.create_index("auth_sessions_expires_at_idx", "auth_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_index("auth_sessions_expires_at_idx", table_name="auth_sessions")
    op.drop_index("auth_sessions_user_id_idx", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("users_email_unique_idx", table_name="users")
    op.drop_column("users", "password_hash")
