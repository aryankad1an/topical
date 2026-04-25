import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

const PostgresEnv = z.object({
  DATABASE_URL: z.string().url(),
});
const ProcessEnv = PostgresEnv.parse(process.env);

// For database connection
const client = postgres(ProcessEnv.DATABASE_URL);
const db = drizzle(client);

async function main() {
  try {
    console.log("Checking database tables...");
    
    // Query to list all tables in the public schema
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log("Tables in the database:");
    tables.forEach((table) => {
      console.log(`- ${table.table_name}`);
    });
    
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    await client.end();
  }
}

main();
