ALTER TABLE "topics" ADD COLUMN "main_topic" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "parent_topic" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "is_subtopic" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_main_topic_idx" ON "topics" ("main_topic");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_parent_topic_idx" ON "topics" ("parent_topic");