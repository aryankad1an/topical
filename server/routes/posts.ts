import { Hono } from "hono";
import { getUser } from "../kinde";
import { db } from "../db";
import { posts, postComments, postVotes } from "../db/schema/posts.ts";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).default(""),
  lessonPlanId: z.number().optional(),
  lessonPlanName: z.string().optional(),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const postsRoute = new Hono()
  .use("*", async (c, next) => {
    if (!db) return c.json({ error: "Database not configured" }, 503);
    await next();
  })

  // ── GET all posts (with sort) ──
  .get("/", async (c) => {
    const sort = c.req.query("sort") || "latest";
    const query = db!.select().from(posts);
    const result = sort === "top"
      ? await query.orderBy(desc(posts.upvotes))
      : await query.orderBy(desc(posts.createdAt));
    return c.json({ posts: result });
  })

  // ── CREATE post ──
  .post("/", getUser, zValidator("json", createPostSchema), async (c) => {
    const user = c.var.user;
    const data = c.req.valid("json");
    const authorName = `${user.given_name || ""}`.trim() || user.email?.split("@")[0] || "Member";
    const [post] = await db!.insert(posts).values({
      userId: user.id,
      authorName,
      title: data.title,
      body: data.body,
      lessonPlanId: data.lessonPlanId ?? null,
      lessonPlanName: data.lessonPlanName ?? null,
    }).returning();
    return c.json({ post }, 201);
  })

  // ── GET single post ──
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [post] = await db!.select().from(posts).where(eq(posts.id, id));
    if (!post) return c.json({ error: "Not found" }, 404);
    const comments = await db!.select().from(postComments)
      .where(eq(postComments.postId, id))
      .orderBy(desc(postComments.createdAt));
    return c.json({ post, comments });
  })

  // ── VOTE ──
  .post("/:id/vote", getUser, zValidator("json", z.object({ vote: z.union([z.literal(1), z.literal(-1)]) })), async (c) => {
    const user = c.var.user;
    const postId = Number(c.req.param("id"));
    const { vote } = c.req.valid("json");

    // Check existing vote
    const [existing] = await db!.select().from(postVotes)
      .where(and(eq(postVotes.postId, postId), eq(postVotes.userId, user.id)));

    if (existing) {
      if (existing.vote === vote) {
        // Undo vote
        await db!.delete(postVotes).where(eq(postVotes.id, existing.id));
        if (vote === 1) {
          await db!.update(posts).set({ upvotes: sql`${posts.upvotes} - 1` }).where(eq(posts.id, postId));
        } else {
          await db!.update(posts).set({ downvotes: sql`${posts.downvotes} - 1` }).where(eq(posts.id, postId));
        }
      } else {
        // Switch vote
        await db!.update(postVotes).set({ vote }).where(eq(postVotes.id, existing.id));
        if (vote === 1) {
          await db!.update(posts).set({ upvotes: sql`${posts.upvotes} + 1`, downvotes: sql`${posts.downvotes} - 1` }).where(eq(posts.id, postId));
        } else {
          await db!.update(posts).set({ upvotes: sql`${posts.upvotes} - 1`, downvotes: sql`${posts.downvotes} + 1` }).where(eq(posts.id, postId));
        }
      }
    } else {
      await db!.insert(postVotes).values({ postId, userId: user.id, vote });
      if (vote === 1) {
        await db!.update(posts).set({ upvotes: sql`${posts.upvotes} + 1` }).where(eq(posts.id, postId));
      } else {
        await db!.update(posts).set({ downvotes: sql`${posts.downvotes} + 1` }).where(eq(posts.id, postId));
      }
    }

    const [updated] = await db!.select().from(posts).where(eq(posts.id, postId));
    return c.json({ post: updated });
  })

  // ── ADD COMMENT ──
  .post("/:id/comments", getUser, zValidator("json", createCommentSchema), async (c) => {
    const user = c.var.user;
    const postId = Number(c.req.param("id"));
    const { body } = c.req.valid("json");
    const authorName = `${user.given_name || ""}`.trim() || user.email?.split("@")[0] || "Member";

    const [comment] = await db!.insert(postComments).values({
      postId, userId: user.id, authorName, body,
    }).returning();

    await db!.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId));
    return c.json({ comment }, 201);
  });
