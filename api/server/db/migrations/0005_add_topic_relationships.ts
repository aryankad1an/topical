import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    -- Add main_topic and parent_topic columns to the topics table
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "main_topic" text;
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "parent_topic" text;
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "is_subtopic" boolean DEFAULT false;

    -- Create indexes for the new columns
    CREATE INDEX IF NOT EXISTS "topics_main_topic_idx" ON "topics" ("main_topic");
    CREATE INDEX IF NOT EXISTS "topics_parent_topic_idx" ON "topics" ("parent_topic");
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    -- Drop indexes
    DROP INDEX IF EXISTS "topics_main_topic_idx";
    DROP INDEX IF EXISTS "topics_parent_topic_idx";
    
    -- Drop columns
    ALTER TABLE "topics" DROP COLUMN IF EXISTS "main_topic";
    ALTER TABLE "topics" DROP COLUMN IF EXISTS "parent_topic";
    ALTER TABLE "topics" DROP COLUMN IF EXISTS "is_subtopic";
  `);
}
