import { text, pgTable, index, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from "zod";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    email: text("email"),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
  },
  (users) => {
    return {
      idIndex: index("users_id_idx").on(users.id),
      emailIndex: index("users_email_idx").on(users.email)
    };
  }
);

// Schema for inserting a user - can be used to validate API requests
export const insertUserSchema = createInsertSchema(users, {
  id: z.string().min(1, { message: "User ID must not be empty" }),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  email: z.string().email().optional()
});

// Schema for selecting a user - can be used to validate API responses
export const selectUserSchema = createSelectSchema(users);
