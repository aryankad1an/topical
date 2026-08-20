import { text, pgTable, index, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").unique(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    email: text("email"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
  },
  (users) => {
    return {
      idIndex: index("users_id_idx").on(users.id),
      emailIndex: index("users_email_idx").on(users.email),
      usernameIndex: index("users_username_idx").on(users.username)
    };
  }
);
