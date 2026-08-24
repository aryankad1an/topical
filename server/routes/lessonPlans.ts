/**
 * Documents: reading, writing, sharing and deleting them.
 *
 * "Lesson plan" is the storage name for what the rest of the app calls a
 * document — the table predates the editor. Access is either ownership or
 * co-authorship, and that rule is spelled out once (`writableBy`) rather than
 * at each of the four handlers that need it: it had been copy-pasted as a raw
 * `jsonb @>` fragment, and a rule duplicated four times is a rule that only
 * has to be fixed in three places to become a hole.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { getUser } from "../kinde";
import { db } from "../db";
import { idParam } from "../http";
import { requireDb } from "../middleware";
import {
  lessonPlans as lessonPlanTable,
  lessonPlanInputSchema,
} from "../db/schema/lessonPlans";
import { users as userTable } from "../db/schema/users";

/**
 * Documents this user may read and write: the ones they own, plus the ones
 * they are named on as a co-author.
 *
 * `coAuthors` is a jsonb array of user ids, so membership is a containment
 * test rather than a join — there is no join table to keep in step.
 */
function writableBy(userId: string) {
  return or(
    eq(lessonPlanTable.userId, userId),
    sql`${lessonPlanTable.coAuthors} @> ${JSON.stringify([userId])}::jsonb`,
  );
}

/**
 * Look up usernames for a set of user ids, in one query.
 *
 * Returns a lookup rather than a parallel array so a caller with several
 * documents resolves every co-author across all of them at once — the list
 * endpoint used to issue this query per document.
 */
async function usernameLookup(ids: string[]): Promise<(id: string) => string> {
  if (!ids.length) return id => id;

  const rows = await db!
    .select({ id: userTable.id, username: userTable.username })
    .from(userTable)
    .where(inArray(userTable.id, [...new Set(ids)]));

  const byId = new Map(rows.filter(row => row.username).map(row => [row.id, row.username!]));
  // An id with no username (or no user) stands in for itself, so a co-author
  // shows as *something* rather than vanishing from the list.
  return id => byId.get(id) ?? id;
}

const coAuthorsOf = (plan: { coAuthors: string[] | null }) => plan.coAuthors ?? [];

export const lessonPlansRoute = new Hono()
  // Every handler below touches the database.
  .use("*", requireDb)

  // ── Everything you can edit ──
  .get("/", getUser, async (c) => {
    const rows = await db!
      .select({ lessonPlan: lessonPlanTable, authorUsername: userTable.username })
      .from(lessonPlanTable)
      .leftJoin(userTable, eq(lessonPlanTable.userId, userTable.id))
      .where(writableBy(c.var.user.id))
      .orderBy(desc(lessonPlanTable.createdAt))
      .limit(100);

    // One lookup for the whole page rather than one per document.
    const usernameOf = await usernameLookup(rows.flatMap(row => coAuthorsOf(row.lessonPlan)));

    const lessonPlans = rows.map(({ lessonPlan, authorUsername }) => ({
      ...lessonPlan,
      authorUsername,
      coAuthorUsernames: coAuthorsOf(lessonPlan).map(usernameOf),
    }));

    return c.json({ lessonPlans });
  })

  // ── Published documents ──
  // Ahead of "/:id" so the literal segment is not read as an id.
  .get("/public", async (c) => {
    const lessonPlans = await db!
      .select()
      .from(lessonPlanTable)
      .where(eq(lessonPlanTable.isPublic, true))
      .orderBy(desc(lessonPlanTable.createdAt))
      .limit(100);
    return c.json({ lessonPlans });
  })

  .get("/public/:id", async (c) => {
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid lesson plan ID" }, 400);

    const [lessonPlan] = await db!
      .select()
      .from(lessonPlanTable)
      .where(and(eq(lessonPlanTable.id, id), eq(lessonPlanTable.isPublic, true)))
      .limit(1);

    // A private document and a missing one answer alike: whether an id exists
    // is not something an unauthenticated caller should be able to probe.
    if (!lessonPlan) return c.json({ error: "Public lesson plan not found" }, 404);
    return c.json(lessonPlan);
  })

  // ── One document ──
  .get("/:id", getUser, async (c) => {
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid lesson plan ID" }, 400);

    const [row] = await db!
      .select({ lessonPlan: lessonPlanTable, authorUsername: userTable.username })
      .from(lessonPlanTable)
      .leftJoin(userTable, eq(lessonPlanTable.userId, userTable.id))
      .where(and(eq(lessonPlanTable.id, id), writableBy(c.var.user.id)))
      .limit(1);

    if (!row) return c.json({ error: "Lesson plan not found" }, 404);

    const coAuthors = coAuthorsOf(row.lessonPlan);
    const usernameOf = await usernameLookup(coAuthors);

    return c.json({
      ...row.lessonPlan,
      authorUsername: row.authorUsername,
      coAuthorUsernames: coAuthors.map(usernameOf),
    });
  })

  // ── Create ──
  .post("/", getUser, zValidator("json", lessonPlanInputSchema), async (c) => {
    // Validated by zValidator; the owner comes from the session, never the body.
    const [created] = await db!
      .insert(lessonPlanTable)
      .values({ ...c.req.valid("json"), userId: c.var.user.id })
      .returning();
    return c.json(created, 201);
  })

  // ── Replace ──
  .put("/:id", getUser, zValidator("json", lessonPlanInputSchema), async (c) => {
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid lesson plan ID" }, 400);

    // One statement, not two. The access check used to run as its own SELECT
    // with the same WHERE clause the UPDATE then repeated — which is both a
    // wasted round trip and a window in which access could change between
    // them. An UPDATE that matches nothing returns nothing, which is the same
    // answer the SELECT was being asked for.
    const [updated] = await db!
      .update(lessonPlanTable)
      .set({ ...c.req.valid("json"), updatedAt: new Date() })
      .where(and(eq(lessonPlanTable.id, id), writableBy(c.var.user.id)))
      .returning();

    if (!updated) return c.json({ error: "Lesson plan not found" }, 404);
    return c.json(updated);
  })

  // ── Delete ──
  // Owner only: a co-author may edit a document but not destroy it.
  .delete("/:id", getUser, async (c) => {
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid lesson plan ID" }, 400);

    const [deleted] = await db!
      .delete(lessonPlanTable)
      .where(and(eq(lessonPlanTable.id, id), eq(lessonPlanTable.userId, c.var.user.id)))
      .returning({ id: lessonPlanTable.id });

    if (!deleted) return c.json({ error: "Lesson plan not found" }, 404);
    return c.body(null, 204);
  });
