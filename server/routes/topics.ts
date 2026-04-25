import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";
import { db } from "../db";
import {
    topics as topicTable,
    insertTopicSchema,
} from "../db/schema/topics.ts";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

// Define the create topic schema for API validation
export const createTopicSchema = z.object({
    axiosWing: z.string().min(1),
    topic: z.string().min(3),
    difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
    mdxContent: z.string().min(10),
    // Add new fields for topic relationships
    mainTopic: z.string().optional(),
    parentTopic: z.string().optional(),
    isSubtopic: z.boolean().optional()
});

export const topicsRoute = new Hono()
    // Guard: ensure DB is available for all topic routes
    .use("*", async (c, next) => {
        if (!db) {
            return c.json({ error: "Database is not configured. Set DATABASE_URL in .env" }, 503);
        }
        await next();
    })
    // Get all topics for the user
    .get("/", getUser, async (c) => {
        const user = c.var.user;
        const topics = await db!
            .select()
            .from(topicTable)
            .where(eq(topicTable.userId, user.id))
            .orderBy(desc(topicTable.createdAt))
            .limit(100);
        return c.json({ topics });
    })

    // Create a new topic
    .post("/", getUser, zValidator("json", createTopicSchema), async (c) => {
        const topicData = await c.req.valid("json");
        const user = c.var.user;
        const validatedTopic = insertTopicSchema.parse({
            ...topicData,
            userId: user.id,
        });

        const result = await db!
            .insert(topicTable)
            .values(validatedTopic as any)
            .returning()
            .then((res) => res[0]);

        c.status(201);
        return c.json(result);
    })

    // Get topics by difficulty
    .get("/by-difficulty/:difficulty", getUser, async (c) => {
        const difficulty = c.req.param("difficulty");
        const user = c.var.user;

        // Validate difficulty parameter
        if (!["Beginner", "Intermediate", "Advanced"].includes(difficulty)) {
            c.status(400);
            return c.json({ error: "Invalid difficulty level" });
        }

        const topics = await db!
            .select()
            .from(topicTable)
            .where(
                and(
                    eq(topicTable.userId, user.id),
                    eq(topicTable.difficulty, difficulty)
                )
            )
            .orderBy(desc(topicTable.createdAt));

        return c.json({ topics });
    })

    // Get topics by axiom wing
    .get("/by-wing/:wing", getUser, async (c) => {
        const wing = c.req.param("wing");
        const user = c.var.user;

        const topics = await db!
            .select()
            .from(topicTable)
            .where(
                and(
                    eq(topicTable.userId, user.id),
                    eq(topicTable.axiosWing, wing)
                )
            )
            .orderBy(desc(topicTable.createdAt));

        return c.json({ topics });
    })

    // Get a specific topic
    .get("/:id{[0-9]+}", getUser, async (c) => {
        const id = Number.parseInt(c.req.param("id"));
        const user = c.var.user;

        const topic = await db!
            .select()
            .from(topicTable)
            .where(and(eq(topicTable.userId, user.id), eq(topicTable.id, id)))
            .then((res) => res[0]);

        if (!topic) {
            return c.notFound();
        }

        return c.json({ topic });
    })

    // Update a topic
    .put("/:id{[0-9]+}", getUser, zValidator("json", createTopicSchema), async (c) => {
        const id = Number.parseInt(c.req.param("id"));
        const topicData = await c.req.valid("json");
        const user = c.var.user;

        const updatedTopic = await db!
            .update(topicTable)
            .set({
                ...topicData,
                updatedAt: new Date()
            })
            .where(and(eq(topicTable.userId, user.id), eq(topicTable.id, id)))
            .returning()
            .then((res) => res[0]);

        if (!updatedTopic) {
            return c.notFound();
        }

        return c.json({ topic: updatedTopic });
    })

    // Delete a topic
    .delete("/:id{[0-9]+}", getUser, async (c) => {
        const id = Number.parseInt(c.req.param("id"));
        const user = c.var.user;

        const topic = await db!
            .delete(topicTable)
            .where(and(eq(topicTable.userId, user.id), eq(topicTable.id, id)))
            .returning()
            .then((res) => res[0]);

        if (!topic) {
            return c.notFound();
        }

        return c.json({ topic });
    });