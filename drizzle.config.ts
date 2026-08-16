import type { Config } from "drizzle-kit";

export default {
  schema: [
    "./server/db/schema/lessonPlans.ts",
    "./server/db/schema/users.ts",
    "./server/db/schema/posts.ts",
  ],
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
