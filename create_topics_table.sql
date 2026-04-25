CREATE TABLE IF NOT EXISTS "topics" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "axios_wing" text NOT NULL,
  "topic" text NOT NULL,
  "difficulty" text NOT NULL DEFAULT 'Beginner',
  "mdx_content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_id_idx" ON "topics" ("user_id");
CREATE INDEX IF NOT EXISTS "axios_wing_idx" ON "topics" ("axios_wing");
