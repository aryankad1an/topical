import { drizzle } from "drizzle-orm/postgres-js";

import postgres from "postgres";
import { z } from "zod";

const PostgresEnv = z.object({
  DATABASE_URL: z.string().url(),
});

const dbEnvResult = PostgresEnv.safeParse(process.env);

let db: ReturnType<typeof drizzle> | null = null;

if (dbEnvResult.success) {
  const queryClient = postgres(dbEnvResult.data.DATABASE_URL);
  db = drizzle(queryClient);
} else {
  console.warn(
    "⚠️  DATABASE_URL is not configured. Database features will be disabled.\n" +
    "   Set DATABASE_URL in your .env file to enable database functionality.\n"
  );
}

export { db };
