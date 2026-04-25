CREATE TABLE IF NOT EXISTS "lesson_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"main_topic" text NOT NULL,
	"topics" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_plans_user_id_idx" ON "lesson_plans" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_plans_main_topic_idx" ON "lesson_plans" ("main_topic");