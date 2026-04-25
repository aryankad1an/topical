import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      main_topic TEXT NOT NULL,
      topics JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS lesson_plans_user_id_idx ON lesson_plans (user_id);
    CREATE INDEX IF NOT EXISTS lesson_plans_main_topic_idx ON lesson_plans (main_topic);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS lesson_plans;
  `);
}
