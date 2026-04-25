CREATE TABLE IF NOT EXISTS "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"axios_wing" text NOT NULL,
	"topic" text NOT NULL,
	"difficulty" text DEFAULT 'Beginner' NOT NULL,
	"mdx_content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "expenses";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "topics" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "axios_wing_idx" ON "topics" ("axios_wing");