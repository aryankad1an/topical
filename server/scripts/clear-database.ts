import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema/users";
import { lessonPlans } from "../db/schema/lessonPlans";
import { topics } from "../db/schema/topics";

async function clearDatabase() {
  try {
    console.log("Clearing the entire database...");
    
    // Get table names
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("Tables found in the database:");
    tables.forEach((table: any) => {
      console.log(`- ${table.table_name}`);
    });
    
    // Clear each table
    console.log("\nClearing tables...");
    
    // Clear lesson_plans table
    const deletedLessonPlans = await db.delete(lessonPlans).returning();
    console.log(`Deleted ${deletedLessonPlans.length} records from lesson_plans table`);
    
    // Clear topics table
    const deletedTopics = await db.delete(topics).returning();
    console.log(`Deleted ${deletedTopics.length} records from topics table`);
    
    // Clear users table
    const deletedUsers = await db.delete(users).returning();
    console.log(`Deleted ${deletedUsers.length} records from users table`);
    
    console.log("\nDatabase cleared successfully!");
    
  } catch (error) {
    console.error("Error clearing database:", error);
    throw error;
  }
}

// Run the script
clearDatabase()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
