import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE lesson_plans
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX IF NOT EXISTS lesson_plans_is_public_idx ON lesson_plans (is_public);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE lesson_plans
    DROP COLUMN IF EXISTS is_public;
    
    DROP INDEX IF EXISTS lesson_plans_is_public_idx;
  `);
}
