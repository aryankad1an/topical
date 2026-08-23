import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";
import { db } from "../db";
import {
    lessonPlans as lessonPlanTable,
    lessonPlanInputSchema,
} from "../db/schema/lessonPlans.ts";
import { users as userTable } from "../db/schema/users.ts";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireDb } from "../middleware";

export const lessonPlansRoute = new Hono()
    // Guard: ensure DB is available for all lesson plan routes
    .use("*", requireDb)
    // Get all lesson plans for the user
    .get("/", getUser, async (c) => {
        const user = c.var.user;
        const lessonPlansRaw = await db!
            .select({
                lessonPlan: lessonPlanTable,
                authorUsername: userTable.username
            })
            .from(lessonPlanTable)
            .leftJoin(userTable, eq(lessonPlanTable.userId, userTable.id))
            .where(or(
                eq(lessonPlanTable.userId, user.id),
                sql`${lessonPlanTable.coAuthors} @> ${JSON.stringify([user.id])}::jsonb`
            ))
            .orderBy(desc(lessonPlanTable.createdAt))
            .limit(100);

        // Collect all unique co-author IDs to resolve usernames in one query
        const allCoAuthorIds = new Set<string>();
        for (const row of lessonPlansRaw) {
            const ca = (row.lessonPlan.coAuthors || []) as string[];
            ca.forEach(id => allCoAuthorIds.add(id));
        }

        // Batch-resolve co-author usernames
        const usernameMap: Record<string, string> = {};
        if (allCoAuthorIds.size > 0) {
            const coAuthorUsers = await db!
                .select({ id: userTable.id, username: userTable.username })
                .from(userTable)
                .where(inArray(userTable.id, [...allCoAuthorIds]));
            for (const u of coAuthorUsers) {
                if (u.username) usernameMap[u.id] = u.username;
            }
        }

        const lessonPlans = lessonPlansRaw.map(row => ({
            ...row.lessonPlan,
            authorUsername: row.authorUsername,
            coAuthorUsernames: ((row.lessonPlan.coAuthors || []) as string[]).map(id => usernameMap[id] || id)
        }));
        
        return c.json({ lessonPlans });
    })

    // Get all public lesson plans
    .get("/public", async (c) => {
        const publicLessonPlans = await db!
            .select()
            .from(lessonPlanTable)
            .where(eq(lessonPlanTable.isPublic, true))
            .orderBy(desc(lessonPlanTable.createdAt))
            .limit(100);
        return c.json({ lessonPlans: publicLessonPlans });
    })

    // Get a specific public lesson plan by ID
    .get("/public/:id", async (c) => {
        const id = parseInt(c.req.param("id"));

        if (isNaN(id)) {
            c.status(400);
            return c.json({ error: "Invalid lesson plan ID" });
        }

        const lessonPlan = await db!
            .select()
            .from(lessonPlanTable)
            .where(and(
                eq(lessonPlanTable.id, id),
                eq(lessonPlanTable.isPublic, true)
            ))
            .limit(1);

        if (!lessonPlan.length) {
            c.status(404);
            return c.json({ error: "Public lesson plan not found" });
        }

        return c.json(lessonPlan[0]);
    })

    // Get a specific lesson plan by ID
    .get("/:id", getUser, async (c) => {
        const user = c.var.user;
        const id = parseInt(c.req.param("id"));

        if (isNaN(id)) {
            c.status(400);
            return c.json({ error: "Invalid lesson plan ID" });
        }

        const lessonPlanRaw = await db!
            .select({
                lessonPlan: lessonPlanTable,
                authorUsername: userTable.username
            })
            .from(lessonPlanTable)
            .leftJoin(userTable, eq(lessonPlanTable.userId, userTable.id))
            .where(and(
                eq(lessonPlanTable.id, id),
                or(
                    eq(lessonPlanTable.userId, user.id),
                    sql`${lessonPlanTable.coAuthors} @> ${JSON.stringify([user.id])}::jsonb`
                )
            ))
            .limit(1);

        if (!lessonPlanRaw.length) {
            c.status(404);
            return c.json({ error: "Lesson plan not found" });
        }

        const row = lessonPlanRaw[0];
        const coAuthorIds = (row.lessonPlan.coAuthors || []) as string[];
        let coAuthorUsernames: string[] = [];
        if (coAuthorIds.length > 0) {
            const coUsers = await db!
                .select({ id: userTable.id, username: userTable.username })
                .from(userTable)
                .where(inArray(userTable.id, coAuthorIds));
            const map: Record<string, string> = {};
            for (const u of coUsers) { if (u.username) map[u.id] = u.username; }
            coAuthorUsernames = coAuthorIds.map(id => map[id] || id);
        }

        return c.json({
            ...row.lessonPlan,
            authorUsername: row.authorUsername,
            coAuthorUsernames
        });
    })

    // Create a new lesson plan
    .post("/", getUser, zValidator("json", lessonPlanInputSchema), async (c) => {
        // Already validated by zValidator above; the session supplies the owner.
        const lessonPlanData = c.req.valid("json");
        const user = c.var.user;

        const result = await db!
            .insert(lessonPlanTable)
            .values({ ...lessonPlanData, userId: user.id })
            .returning()
            .then((res) => res[0]);

        c.status(201);
        return c.json(result);
    })

    // Update an existing lesson plan
    .put("/:id", getUser, zValidator("json", lessonPlanInputSchema), async (c) => {
        const lessonPlanData = c.req.valid("json");
        const user = c.var.user;
        const id = parseInt(c.req.param("id"));

        if (isNaN(id)) {
            c.status(400);
            return c.json({ error: "Invalid lesson plan ID" });
        }

        // Check if the lesson plan exists and user has access
        const existingLessonPlan = await db!
            .select()
            .from(lessonPlanTable)
            .where(and(
                eq(lessonPlanTable.id, id),
                or(
                    eq(lessonPlanTable.userId, user.id),
                    sql`${lessonPlanTable.coAuthors} @> ${JSON.stringify([user.id])}::jsonb`
                )
            ))
            .limit(1);

        if (!existingLessonPlan.length) {
            c.status(404);
            return c.json({ error: "Lesson plan not found" });
        }

        // Update the lesson plan
        const result = await db!
            .update(lessonPlanTable)
            .set({
                name: lessonPlanData.name,
                mainTopic: lessonPlanData.mainTopic,
                topics: lessonPlanData.topics,
                coAuthors: lessonPlanData.coAuthors,
                isPublic: lessonPlanData.isPublic,
                updatedAt: new Date()
            })
            .where(and(
                eq(lessonPlanTable.id, id),
                or(
                    eq(lessonPlanTable.userId, user.id),
                    sql`${lessonPlanTable.coAuthors} @> ${JSON.stringify([user.id])}::jsonb`
                )
            ))
            .returning()
            .then((res) => res[0]);

        return c.json(result);
    })

    // Delete a lesson plan
    .delete("/:id", getUser, async (c) => {
        const user = c.var.user;
        const id = parseInt(c.req.param("id"));

        if (isNaN(id)) {
            c.status(400);
            return c.json({ error: "Invalid lesson plan ID" });
        }

        // Check if the lesson plan exists and belongs to the user
        const existingLessonPlan = await db!
            .select()
            .from(lessonPlanTable)
            .where(and(
                eq(lessonPlanTable.id, id),
                eq(lessonPlanTable.userId, user.id)
            ))
            .limit(1);

        if (!existingLessonPlan.length) {
            c.status(404);
            return c.json({ error: "Lesson plan not found" });
        }

        // Delete the lesson plan
        await db!
            .delete(lessonPlanTable)
            .where(and(
                eq(lessonPlanTable.id, id),
                eq(lessonPlanTable.userId, user.id)
            ));

        c.status(204);
        return c.body(null);
    });
