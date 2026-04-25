import { db } from "../db";
import { sql } from "drizzle-orm";

async function checkDbConnection() {
  try {
    console.log("Checking database connection...");
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("Database connection successful:", result);
  } catch (error) {
    console.error("Error connecting to database:", error);
  } finally {
    process.exit(0);
  }
}

checkDbConnection();
