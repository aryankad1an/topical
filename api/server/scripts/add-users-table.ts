import { sql } from "drizzle-orm";
import { db } from "../db";

async function addUsersTable() {
  try {
    console.log("Creating users table if it doesn't exist...");
    
    // Create the users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY,
        "given_name" text,
        "family_name" text,
        "email" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);
    
    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "users_id_idx" ON "users" ("id");
      CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
    `);
    
    console.log("Users table created successfully");
  } catch (error) {
    console.error("Error creating users table:", error);
    throw error;
  }
}

// Run the migration
addUsersTable()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
