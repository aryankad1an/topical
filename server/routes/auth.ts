import { Hono } from "hono";

import { kindeClient, sessionManager, isKindeConfigured } from "../kinde";
import { getUser } from "../kinde";
import { db } from "../db";
import { users as userTable } from "../db/schema/users";
import { lessonPlans } from "../db/schema/lessonPlans";
import { eq, ilike, and, or, desc, isNotNull } from "drizzle-orm";

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
    const url = new URL(c.req.url);
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
    let dbUser: typeof userTable.$inferSelect | null = null;
    let isNewUser = false;

    // Skip DB caching if database is not available
    if (db) {
      try {
        // Check if user already exists in the database
        const existingUser = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1);

        // If user doesn't exist, insert them — this is the very first time
        // we've seen this Kinde user, so flag it as a fresh signup.
        if (!existingUser.length) {
          isNewUser = true;
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

    return c.json({
      user: {
        ...user,
        username: dbUser?.username || null,
        bio: dbUser?.bio || null,
        avatarUrl: dbUser?.avatarUrl || null,
      },
      isNewUser,
    });
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
          avatar_url: user.avatarUrl || null,
        }
      });
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return c.json({ error: "Failed to fetch user information" }, 500);
    }
  })
  // Update the current user's profile — any subset of username/bio/avatarUrl
  .patch("/profile", getUser, async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);

    try {
      const body = await c.req.json();
      const updates: Record<string, unknown> = {};

      if (body.username !== undefined) {
        const { username } = body;
        if (typeof username !== "string" || username.length < 3) {
          return c.json({ error: "Valid username of at least 3 characters is required" }, 400);
        }
        const existing = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
        if (existing.length > 0 && existing[0].id !== c.var.user.id) {
          return c.json({ error: "Username is already taken" }, 409);
        }
        updates.username = username;
      }

      if (body.bio !== undefined) {
        const { bio } = body;
        if (bio !== null && (typeof bio !== "string" || bio.length > 280)) {
          return c.json({ error: "Bio must be 280 characters or fewer" }, 400);
        }
        updates.bio = bio;
      }

      if (body.avatarUrl !== undefined) {
        const { avatarUrl } = body;
        if (avatarUrl !== null && typeof avatarUrl !== "string") {
          return c.json({ error: "Invalid avatar URL" }, 400);
        }
        updates.avatarUrl = avatarUrl;
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

      updates.updatedAt = new Date();
      const [updated] = await db.update(userTable)
        .set(updates)
        .where(eq(userTable.id, c.var.user.id))
        .returning();

      return c.json({
        success: true,
        user: {
          username: updated.username,
          bio: updated.bio,
          avatarUrl: updated.avatarUrl,
        },
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      return c.json({ error: "Failed to update profile" }, 500);
    }
  })
  .get("/search/username", getUser, async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const query = c.req.query("q");
    if (!query || query.length < 2) return c.json({ users: [] });

    try {
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
  })

  // ── Browse people ──
  // Richer than /search/username (which backs the co-author picker): carries
  // the fields a profile card needs, and lists everyone when q is empty.
  .get("/people", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const q = (c.req.query("q") || "").trim();

    try {
      const columns = {
        id: userTable.id,
        username: userTable.username,
        givenName: userTable.givenName,
        familyName: userTable.familyName,
        bio: userTable.bio,
        avatarUrl: userTable.avatarUrl,
        createdAt: userTable.createdAt,
      };
      // Only users who claimed a username are listed — a username is what
      // makes a profile addressable and publishable.
      const base = db.select(columns).from(userTable);
      const people = q
        ? await base.where(and(
            isNotNull(userTable.username),
            or(
              ilike(userTable.username, `%${q}%`),
              ilike(userTable.givenName, `%${q}%`),
              ilike(userTable.familyName, `%${q}%`),
            ),
          )).limit(50)
        : await base.where(isNotNull(userTable.username)).limit(50);

      return c.json({ people });
    } catch (error) {
      console.error("Error listing people:", error);
      return c.json({ error: "Failed to list people" }, 500);
    }
  })

  // ── Public profile by username ──
  .get("/people/:username", async (c) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    const username = c.req.param("username");

    try {
      const [person] = await db
        .select({
          id: userTable.id,
          username: userTable.username,
          givenName: userTable.givenName,
          familyName: userTable.familyName,
          bio: userTable.bio,
          avatarUrl: userTable.avatarUrl,
          createdAt: userTable.createdAt,
        })
        .from(userTable)
        .where(eq(userTable.username, username));

      if (!person) return c.json({ error: "Profile not found" }, 404);

      // Their published work is the substance of a public profile.
      const published = await db
        .select({
          id: lessonPlans.id,
          name: lessonPlans.name,
          mainTopic: lessonPlans.mainTopic,
          createdAt: lessonPlans.createdAt,
          updatedAt: lessonPlans.updatedAt,
        })
        .from(lessonPlans)
        .where(and(eq(lessonPlans.userId, person.id), eq(lessonPlans.isPublic, true)))
        .orderBy(desc(lessonPlans.updatedAt));

      return c.json({ person, published });
    } catch (error) {
      console.error("Error fetching profile:", error);
      return c.json({ error: "Failed to load profile" }, 500);
    }
  });
