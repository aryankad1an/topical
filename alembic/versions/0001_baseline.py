"""Baseline: the schema as it stood before this backend.

Every statement is idempotent (``IF NOT EXISTS``), because this revision has
two jobs: create the schema on an empty database, and be a no-op on one that
already carries these tables from the previous backend's migrations. That is
what lets an existing deployment run ``alembic upgrade head`` without first
being stamped by hand.

Revision ID: 0001_baseline
Revises:
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


STATEMENTS = [
    """
CREATE TABLE IF NOT EXISTS "users" (
    "id" text PRIMARY KEY NOT NULL,
    "username" text,
    "given_name" text,
    "family_name" text,
    "email" text,
    "bio" text,
    "avatar_url" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "users_username_unique" UNIQUE("username")
);

""",
    """CREATE TABLE IF NOT EXISTS "lesson_plans" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "main_topic" text NOT NULL,
    "topics" jsonb NOT NULL,
    "co_authors" jsonb DEFAULT '[]'::jsonb,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

""",
    """CREATE TABLE IF NOT EXISTS "community_posts" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "author_name" text DEFAULT 'Anonymous' NOT NULL,
    "title" text NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "lesson_plan_id" integer,
    "lesson_plan_name" text,
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now()
);

""",
    """CREATE TABLE IF NOT EXISTS "community_post_comments" (
    "id" serial PRIMARY KEY NOT NULL,
    "post_id" integer NOT NULL,
    "user_id" text NOT NULL,
    "author_name" text DEFAULT 'Anonymous' NOT NULL,
    "body" text NOT NULL,
    "created_at" timestamp DEFAULT now()
);

""",
    """CREATE TABLE IF NOT EXISTS "community_post_votes" (
    "id" serial PRIMARY KEY NOT NULL,
    "post_id" integer NOT NULL,
    "user_id" text NOT NULL,
    "vote" integer NOT NULL
);
""",
    # bio and avatar_url arrived after the first release; an existing database
    # may predate them.
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text',
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text',
    'CREATE INDEX IF NOT EXISTS "lesson_plans_user_id_idx" ON "lesson_plans" ("user_id")',
    'CREATE INDEX IF NOT EXISTS "lesson_plans_main_topic_idx" ON "lesson_plans" ("main_topic")',
    'CREATE INDEX IF NOT EXISTS "users_id_idx" ON "users" ("id")',
    'CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")',
    'CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username")',
]


def upgrade() -> None:
    # One statement per call: asyncpg prepares every statement it is given, and
    # a prepared statement cannot carry more than one command.
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    # Deliberately not implemented: this revision's whole purpose is to adopt a
    # schema that may already hold data, and dropping those tables on a
    # `downgrade base` would destroy it.
    raise NotImplementedError("The baseline revision is not reversible.")
