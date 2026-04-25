import { db } from "../db";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";

async function addSampleUsers() {
  try {
    console.log("Adding sample users...");

    // Sample users to add
    const sampleUsers = [
      {
        id: "kp_b346983c123c4b9b84fdb7b39c879d3c",
        givenName: "Alex",
        familyName: "Johnson",
        email: "alex.johnson@example.com"
      },
      {
        id: "kp_ccce1c36cde3409bad555846eefbb5be",
        givenName: "Sarah",
        familyName: "Williams",
        email: "sarah.williams@example.com"
      }
    ];

    // Add each user if they don't already exist
    for (const user of sampleUsers) {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq => eq(users.id, user.id))
        .limit(1);

      if (existingUser.length === 0) {
        // User doesn't exist, add them
        await db.insert(users).values(user);
        console.log(`Added user: ${user.givenName} ${user.familyName} (${user.id})`);
      } else {
        console.log(`User already exists: ${user.id}`);
      }
    }

    // List all users in the database
    const allUsers = await db.select().from(users);

    console.log(`\nAll users in the database (${allUsers.length}):`);
    allUsers.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.givenName} ${user.familyName}`);
      console.log(`  Email: ${user.email}`);
      console.log('---');
    });

  } catch (error) {
    console.error("Error adding sample users:", error);
    throw error;
  }
}

// Run the script
addSampleUsers()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
