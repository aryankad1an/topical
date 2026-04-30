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
    return c.redirect("/?auth_success=1");
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
    let dbUser: any = null;

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
          const inserted = await db.insert(userTable).values({
            id: user.id,
            givenName: user.given_name,
            familyName: user.family_name,
            email: user.email,
          }).returning();
          dbUser = inserted[0];
        }
        // If user exists but information might have changed, update them
        else {
          dbUser = existingUser[0];
          if (
            existingUser[0].givenName !== user.given_name ||
            existingUser[0].familyName !== user.family_name ||
            existingUser[0].email !== user.email
          ) {
            const updated = await db
              .update(userTable)
              .set({
                givenName: user.given_name,
                familyName: user.family_name,
                email: user.email,
                updatedAt: new Date()
              })
              .where(eq(userTable.id, user.id))
              .returning();
            dbUser = updated[0];
          }
        }
      } catch (error) {
        console.error("Error caching user information:", error);
        // Continue anyway, as this is just for caching
      }
    }

    return c.json({ user: { ...user, username: dbUser?.username || null } });
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
          username: user.username || null,
        }
      });
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return c.json({ error: "Failed to fetch user information" }, 500);
    }
  })
  .patch("/username", getUser, async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    
    try {
      const { username } = await c.req.json();
      if (!username || typeof username !== "string" || username.length < 3) {
        return c.json({ error: "Valid username of at least 3 characters is required" }, 400);
      }

      // Check if username is taken
      const existing = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
      if (existing.length > 0 && existing[0].id !== c.var.user.id) {
        return c.json({ error: "Username is already taken" }, 409);
      }

      await db.update(userTable)
        .set({ username, updatedAt: new Date() })
        .where(eq(userTable.id, c.var.user.id));
        
      return c.json({ success: true, username });
    } catch (error) {
      console.error("Error updating username:", error);
      return c.json({ error: "Failed to update username" }, 500);
    }
  })
  .get("/search/username", getUser, async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const query = c.req.query("q");
    if (!query || query.length < 2) return c.json({ users: [] });

    try {
      const { ilike } = await import("drizzle-orm");
      const matchedUsers = await db
        .select({ id: userTable.id, username: userTable.username, givenName: userTable.givenName })
        .from(userTable)
        .where(ilike(userTable.username, `%${query}%`))
        .limit(10);
      return c.json({ users: matchedUsers });
    } catch (error) {
      console.error("Error searching users:", error);
      return c.json({ error: "Failed to search users" }, 500);
    }
  });
