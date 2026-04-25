import { db } from "../db";
import { sql } from "drizzle-orm";

async function checkMigrations() {
  try {
    console.log("Checking migrations...");
    const result = await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`);
    console.log("Migrations:", result);
  } catch (error) {
    console.error("Error checking migrations:", error);
  } finally {
    process.exit(0);
  }
}

checkMigrations();
