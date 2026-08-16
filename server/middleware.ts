import { createMiddleware } from "hono/factory";
import { db } from "./db";

/**
 * Guard middleware: rejects requests with 503 when the database is not
 * configured (DATABASE_URL missing). Mount with `.use("*", requireDb)` on
 * any route group whose handlers touch the database, so individual handlers
 * can safely use `db!`.
 */
export const requireDb = createMiddleware(async (c, next) => {
  if (!db) {
    return c.json({ error: "Database is not configured. Set DATABASE_URL in .env" }, 503);
  }
  await next();
});
