import { db } from "../db";
import { sql } from "drizzle-orm";

async function addIsPublicColumn() {
  try {
    console.log("Adding is_public column to lesson_plans table...");
    await db.execute(sql`
      ALTER TABLE lesson_plans
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
      
      CREATE INDEX IF NOT EXISTS lesson_plans_is_public_idx ON lesson_plans (is_public);
    `);
    console.log("Column added successfully");
  } catch (error) {
    console.error("Error adding column:", error);
  } finally {
    process.exit(0);
  }
}

addIsPublicColumn();
