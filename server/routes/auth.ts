import { Hono } from "hono";

import { kindeClient, sessionManager, isKindeConfigured } from "../kinde";
import { getUser } from "../kinde";
import { db } from "../db";
import { users as userTable } from "../db/schema/users";
import { eq } from "drizzle-orm";

export const authRoute = new Hono()
  .get("/login", async (c) => {
    if (!kindeClient) {
      return c.json({ error: "Auth is not configured. Set Kinde env vars in .env" }, 503);
    }
    const loginUrl = await kindeClient.login(sessionManager(c));
    return c.redirect(loginUrl.toString());
  })
  .get("/register", async (c) => {
    if (!kindeClient) {
      return c.json({ error: "Auth is not configured. Set Kinde env vars in .env" }, 503);
    }
    const registerUrl = await kindeClient.register(sessionManager(c));
    return c.redirect(registerUrl.toString());
  })
  .get("/callback", async (c) => {
    if (!kindeClient) {
      return c.json({ error: "Auth is not configured" }, 503);
    }
    // get called every time we login or register
    const url: any = new URL(c.req.url);
    await kindeClient.handleRedirectToApp(sessionManager(c), url);
    return c.redirect("/");
  })
  .get("/logout", async (c) => {
    if (!kindeClient) {
      return c.redirect("/");
    }
    const logoutUrl = await kindeClient.logout(sessionManager(c));
    return c.redirect(logoutUrl.toString());
  })
  .get("/me", getUser, async (c) => {
    const user = c.var.user;

    // Skip DB caching if database is not available
    if (db) {
      try {
        // Check if user already exists in the database
        const existingUser = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1);

        // If user doesn't exist, insert them
        if (!existingUser.length) {
          await db.insert(userTable).values({
            id: user.id,
            givenName: user.given_name,
            familyName: user.family_name,
            email: user.email,
          });
        }
        // If user exists but information might have changed, update them
        else if (
          existingUser[0].givenName !== user.given_name ||
          existingUser[0].familyName !== user.family_name ||
          existingUser[0].email !== user.email
        ) {
          await db
            .update(userTable)
            .set({
              givenName: user.given_name,
              familyName: user.family_name,
              email: user.email,
              updatedAt: new Date()
            })
            .where(eq(userTable.id, user.id));
        }
      } catch (error) {
        console.error("Error caching user information:", error);
        // Continue anyway, as this is just for caching
      }
    }

    return c.json({ user });
  })
  // Get user information by ID (for public display)
  .get("/user/:id", async (c) => {
    const userId = c.req.param("id");

    if (!db) {
      return c.json({ error: "Database not configured" }, 503);
    }

    try {
      // Try to get user from our database cache first
      const user = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
        .then(res => res[0]);

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Return only the necessary public information
      return c.json({
        user: {
          id: user.id,
          given_name: user.givenName || null,
          family_name: user.familyName || null,
          // Don't include email or other private information
        }
      });
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return c.json({ error: "Failed to fetch user information" }, 500);
    }
  });
