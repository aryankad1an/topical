/**
 * Sessions, the current user, and the public profile surface.
 *
 * Sign-in and sign-out are real redirects to Kinde, not XHR — the browser
 * performs the navigation, so these handlers only start and finish it. `/me`
 * answers 401 for an anonymous visitor rather than erroring, because that is
 * the expected state on a first visit and the client treats it as "no session".
 *
 * Both Kinde and the database are optional at boot (see `../kinde` and
 * `../db`), so most handlers here need a guard saying which one they depend
 * on. Those guards are middleware — `requireKinde` and `requireDb` — rather
 * than an `if` at the top of each handler, which is what they were: the same
 * four lines written out nine times, in three different wordings.
 */

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { and, desc, eq, ilike, isNotNull, or } from "drizzle-orm";

import { db } from "../db";
import { getUser, kindeClient, sessionManager } from "../kinde";
import { requireDb } from "../middleware";
import { lessonPlans } from "../db/schema/lessonPlans";
import { users as userTable } from "../db/schema/users";
// The same rules the edit form applies — see ../validation.
import { MAX_BIO_LENGTH, USERNAME_PATTERN, USERNAME_RULE } from "../validation";

/** Refuse the request when Kinde was never configured. */
const requireKinde = createMiddleware(async (c, next) => {
  if (!kindeClient) {
    return c.json({ error: "Auth is not configured. Set Kinde env vars in .env" }, 503);
  }
  await next();
});

/**
 * The columns a profile card needs.
 *
 * Written out once: the browse list and the single-profile lookup return the
 * same person and had two copies of this list, so a column added to one was
 * missing from the other.
 */
const publicUserColumns = {
  id: userTable.id,
  username: userTable.username,
  givenName: userTable.givenName,
  familyName: userTable.familyName,
  bio: userTable.bio,
  avatarUrl: userTable.avatarUrl,
  createdAt: userTable.createdAt,
};

export const authRoute = new Hono()
  // ── Session ──
  .get("/login", requireKinde, async (c) =>
    c.redirect((await kindeClient!.login(sessionManager(c))).toString()))

  .get("/register", requireKinde, async (c) =>
    c.redirect((await kindeClient!.register(sessionManager(c))).toString()))

  // Kinde sends the browser back here after every login and registration.
  .get("/callback", requireKinde, async (c) => {
    await kindeClient!.handleRedirectToApp(sessionManager(c), new URL(c.req.url));
    return c.redirect("/?auth_success=1");
  })

  // No guard: with Kinde unconfigured there is no session to end, and sending
  // someone to an error page for signing out would be absurd.
  .get("/logout", async (c) => {
    if (!kindeClient) return c.redirect("/");
    return c.redirect((await kindeClient.logout(sessionManager(c))).toString());
  })

  // ── The signed-in user ──
  // Deliberately usable without a database: the identity comes from Kinde, and
  // the row here is only a cache of it plus the fields Kinde does not hold.
  .get("/me", getUser, async (c) => {
    const user = c.var.user;
    let profile: typeof userTable.$inferSelect | null = null;
    let isNewUser = false;

    if (db) {
      try {
        [profile] = await db.select().from(userTable).where(eq(userTable.id, user.id)).limit(1);

        if (!profile) {
          // First time this Kinde account has been seen — flag it so the
          // client can run onboarding.
          isNewUser = true;
          [profile] = await db.insert(userTable).values({
            id: user.id,
            givenName: user.given_name,
            familyName: user.family_name,
            email: user.email,
          }).returning();
        } else if (
          profile.givenName !== user.given_name ||
          profile.familyName !== user.family_name ||
          profile.email !== user.email
        ) {
          // Kinde is the authority on these three; refresh the cache when it
          // has moved on.
          [profile] = await db.update(userTable)
            .set({
              givenName: user.given_name,
              familyName: user.family_name,
              email: user.email,
              updatedAt: new Date(),
            })
            .where(eq(userTable.id, user.id))
            .returning();
        }
      } catch (error) {
        // Caching is not worth failing a session check over.
        console.error("Error caching user information:", error);
      }
    }

    return c.json({
      user: {
        ...user,
        username: profile?.username ?? null,
        bio: profile?.bio ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
      isNewUser,
    });
  })

  // ── One user, by id, for attribution on someone else's work ──
  .get("/user/:id", requireDb, async (c) => {
    const [user] = await db!
      .select()
      .from(userTable)
      .where(eq(userTable.id, c.req.param("id")))
      .limit(1);

    if (!user) return c.json({ error: "User not found" }, 404);

    // Only what a byline needs — no email, no bio.
    return c.json({
      user: {
        id: user.id,
        given_name: user.givenName,
        family_name: user.familyName,
        username: user.username,
        avatar_url: user.avatarUrl,
      },
    });
  })

  // ── Edit your own profile ──
  // Any subset of username/bio/avatarUrl; anything absent is left alone.
  .patch("/profile", requireDb, getUser, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Expected a JSON object" }, 400);
    }

    const updates: Partial<typeof userTable.$inferInsert> = {};

    if (body.username !== undefined) {
      // The same rule the edit form applies. It was enforced only in the
      // browser, so a direct PATCH could set a username containing a slash or
      // a space — which then produced a /u/<name> profile link that could not
      // resolve back to its own account.
      if (typeof body.username !== "string" || !USERNAME_PATTERN.test(body.username)) {
        return c.json({ error: USERNAME_RULE }, 400);
      }
      const [taken] = await db!
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.username, body.username))
        .limit(1);
      if (taken && taken.id !== c.var.user.id) {
        return c.json({ error: "Username is already taken" }, 409);
      }
      updates.username = body.username;
    }

    if (body.bio !== undefined) {
      if (body.bio !== null && (typeof body.bio !== "string" || body.bio.length > MAX_BIO_LENGTH)) {
        return c.json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer` }, 400);
      }
      updates.bio = body.bio;
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl !== null && typeof body.avatarUrl !== "string") {
        return c.json({ error: "Invalid avatar URL" }, 400);
      }
      updates.avatarUrl = body.avatarUrl;
    }

    if (!Object.keys(updates).length) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const [updated] = await db!.update(userTable)
      .set({ ...updates, updatedAt: new Date() })
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
  })

  // ── Username autocomplete, for the co-author picker ──
  // Narrower than /people on purpose: it is a picker, not a directory.
  .get("/search/username", requireDb, getUser, async (c) => {
    const query = c.req.query("q") ?? "";
    if (query.length < 2) return c.json({ users: [] });

    const users = await db!
      .select({ id: userTable.id, username: userTable.username, givenName: userTable.givenName })
      .from(userTable)
      .where(ilike(userTable.username, `%${query}%`))
      .limit(10);
    return c.json({ users });
  })

  // ── Browse people ──
  // Only users who claimed a username are listed — a username is what makes a
  // profile addressable and publishable.
  .get("/people", requireDb, async (c) => {
    const query = (c.req.query("q") ?? "").trim();

    const people = await db!
      .select(publicUserColumns)
      .from(userTable)
      .where(and(
        isNotNull(userTable.username),
        query
          ? or(
              ilike(userTable.username, `%${query}%`),
              ilike(userTable.givenName, `%${query}%`),
              ilike(userTable.familyName, `%${query}%`),
            )
          : undefined,
      ))
      .limit(50);

    return c.json({ people });
  })

  // ── One public profile, by username ──
  .get("/people/:username", requireDb, async (c) => {
    const [person] = await db!
      .select(publicUserColumns)
      .from(userTable)
      .where(eq(userTable.username, c.req.param("username")))
      .limit(1);

    if (!person) return c.json({ error: "Profile not found" }, 404);

    // Their published work is the substance of a public profile.
    const published = await db!
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
  });
