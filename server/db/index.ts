/**
 * The database handle, or `null` when `DATABASE_URL` is unset.
 *
 * Null rather than a throw, so the server still boots for anyone who only
 * wants the frontend: routes that need it mount `requireDb` (see
 * `../middleware`), which answers 503 with an actionable message, and their
 * handlers can then safely use `db!`.
 */

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
