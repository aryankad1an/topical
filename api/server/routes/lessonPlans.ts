import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";
import { db } from "../db";
import {
    lessonPlans as lessonPlanTable,
    insertLessonPlanSchema,
} from "../db/schema/lessonPlans.ts";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

// Define the create lesson plan schema for API validation
export const createLessonPlanSchema = z.object({
    name: z.string().min(1),
    mainTopic: z.string().min(1),
    topics: z.array(z.object({
        topic: z.string().min(1),
        mdxContent: z.string(),
        isSubtopic: z.boolean(),
        parentTopic: z.string().optional(),
        mainTopic: z.string().optional()
    })),
    isPublic: z.boolean().default(false)
});

export const lessonPlansRoute = new Hono()
    // Guard: ensure DB is available for all lesson plan routes
    .use("*", async (c, next) => {
        if (!db) {
            return c.json({ error: "Database is not configured. Set DATABASE_URL in .env" }, 503);
        }
        await next();
    })
    // Get all lesson plans for the user
    .get("/", getUser, async (c) => {
        const user = c.var.user;
        const lessonPlans = await db!
            .select()
            .from(lessonPlanTable)
            .where(eq(lessonPlanTable.userId, user.id))
            .orderBy(desc(lessonPlanTable.createdAt))
            .limit(100);
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

        // Log the request for debugging
        console.log(`Fetching public lesson plan with ID: ${id}`);
      

        const lessonPlan = await db!
            .select()
            .from(lessonPlanTable)
            .where(and(
                eq(lessonPlanTable.id, id),
                eq(lessonPlanTable.isPublic, true)
            ))
            .limit(1);

        // Log the result for debugging
        console.log(`Found ${lessonPlan.length} public lesson plans with ID: ${id}`);
        if (lessonPlan.length > 0) {
            console.log(`Public lesson plan details:`, {
                id: lessonPlan[0].id,
                name: lessonPlan[0].name,
                isPublic: lessonPlan[0].isPublic,
                userId: lessonPlan[0].userId
            });
        }

        if (!lessonPlan.length) {
            c.status(404);
            return c.json({ error: "Public lesson plan not found" });
        }

        return c.json(lessonPlan[0]);
    })

    // Check if a lesson plan is public
    .get("/check-public/:id", async (c) => {
        const id = parseInt(c.req.param("id"));

        if (isNaN(id)) {
            c.status(400);
            return c.json({ error: "Invalid lesson plan ID" });
        }

        // Log the request for debugging
        console.log(`Checking if lesson plan with ID: ${id} is public`);

        const lessonPlan = await db!
            .select({ id: lessonPlanTable.id, isPublic: lessonPlanTable.isPublic })
            .from(lessonPlanTable)
            .where(eq(lessonPlanTable.id, id))
            .limit(1);

        // Log the result for debugging
        console.log(`Found ${lessonPlan.length} lesson plans with ID: ${id}`);
        if (lessonPlan.length > 0) {
            console.log(`Lesson plan public status:`, {
                id: lessonPlan[0].id,
                isPublic: lessonPlan[0].isPublic
            });
        }

        if (!lessonPlan.length) {
            return c.json({ exists: false, isPublic: false });
        }

        return c.json({
            exists: true,
            isPublic: lessonPlan[0].isPublic
        });
    })

    // Get a specific lesson plan by ID
    .get("/:id", getUser, async (c) => {
        const user = c.var.user;
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
                eq(lessonPlanTable.userId, user.id)
            ))
            .limit(1);

        if (!lessonPlan.length) {
            c.status(404);
            return c.json({ error: "Lesson plan not found" });
        }

        return c.json(lessonPlan[0]);
    })

    // Create a new lesson plan
    .post("/", getUser, zValidator("json", createLessonPlanSchema), async (c) => {
        const lessonPlanData = await c.req.valid("json");
        const user = c.var.user;
        const validatedLessonPlan = insertLessonPlanSchema.parse({
            ...lessonPlanData,
            userId: user.id,
        });

        const result = await db!
            .insert(lessonPlanTable)
            .values(validatedLessonPlan as any)
            .returning()
            .then((res) => res[0]);

        c.status(201);
        return c.json(result);
    })

    // Update an existing lesson plan
    .put("/:id", getUser, zValidator("json", createLessonPlanSchema), async (c) => {
        const lessonPlanData = await c.req.valid("json");
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

        // Update the lesson plan
        const result = await db!
            .update(lessonPlanTable)
            .set({
                name: lessonPlanData.name,
                mainTopic: lessonPlanData.mainTopic,
                topics: lessonPlanData.topics as any,
                isPublic: lessonPlanData.isPublic,
                updatedAt: new Date()
            })
            .where(and(
                eq(lessonPlanTable.id, id),
                eq(lessonPlanTable.userId, user.id)
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
