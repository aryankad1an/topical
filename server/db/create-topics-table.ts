import postgres from "postgres";
import { z } from "zod";

const PostgresEnv = z.object({
  DATABASE_URL: z.string().url(),
});
const ProcessEnv = PostgresEnv.parse(process.env);

// For query purposes
const sql = postgres(ProcessEnv.DATABASE_URL);

async function createTopicsTable() {
  console.log("Creating topics table...");
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "topics" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "axios_wing" text NOT NULL,
        "topic" text NOT NULL,
        "difficulty" text NOT NULL DEFAULT 'Beginner',
        "mdx_content" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "user_id_idx" ON "topics" ("user_id");
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "axios_wing_idx" ON "topics" ("axios_wing");
    `;
    
    console.log("Topics table created successfully");
  } catch (error) {
    console.error("Error creating topics table:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createTopicsTable();
