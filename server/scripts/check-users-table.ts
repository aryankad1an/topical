import { db } from "../db";
import { users } from "../db/schema/users";

async function checkUsersTable() {
  try {
    console.log("Checking users table...");
    
    // Get all users
    const allUsers = await db.select().from(users);
    
    console.log(`Found ${allUsers.length} users in the database:`);
    
    if (allUsers.length > 0) {
      allUsers.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.givenName} ${user.familyName}`);
        console.log(`  Created: ${user.createdAt}`);
        console.log('---');
      });
    } else {
      console.log("No users found in the database.");
      
      // Let's add a sample user for testing
      console.log("Adding a sample user for testing...");
      
      await db.insert(users).values({
        id: "kp_b346983c123c4b9b84fdb7b39c879d3c",
        givenName: "John",
        familyName: "Doe",
        email: "john.doe@example.com"
      });
      
      console.log("Sample user added successfully.");
    }
    
  } catch (error) {
    console.error("Error checking users table:", error);
    throw error;
  }
}

// Run the script
checkUsersTable()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
