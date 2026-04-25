import { db } from "../db";
import { sql } from "drizzle-orm";

async function checkTableSchema() {
  try {
    console.log("Checking lesson_plans table schema...");
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'lesson_plans'
      ORDER BY ordinal_position;
    `);
    console.log("Table schema:", result);
  } catch (error) {
    console.error("Error checking table schema:", error);
  } finally {
    process.exit(0);
  }
}

checkTableSchema();
