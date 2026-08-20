import { Hono } from "hono";
import { getUser } from "../kinde";
import { db } from "../db";
import { posts, postComments, postVotes } from "../db/schema/posts.ts";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireDb } from "../middleware";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).default(""),
  lessonPlanId: z.number().optional(),
  lessonPlanName: z.string().optional(),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

/** Display name for a post/comment author: given name, else email handle, else "Member". */
function resolveAuthorName(user: { given_name?: string; email?: string }): string {
  return user.given_name?.trim() || user.email?.split("@")[0] || "Member";
}

export const postsRoute = new Hono()
  .use("*", requireDb)

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
    const authorName = resolveAuthorName(user);
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
    const authorName = resolveAuthorName(user);

    const [comment] = await db!.insert(postComments).values({
      postId, userId: user.id, authorName, body,
    }).returning();

    await db!.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId));
    return c.json({ comment }, 201);
  })

  // ── DELETE post ──
  // Only the author may delete. Votes and comments go too, so no rows are
  // orphaned against a post id that no longer exists.
  .delete("/:id", getUser, async (c) => {
    const user = c.var.user;
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid post id" }, 400);

    const [post] = await db!.select().from(posts).where(eq(posts.id, id));
    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.userId !== user.id) return c.json({ error: "You can only delete your own posts" }, 403);

    await db!.delete(postComments).where(eq(postComments.postId, id));
    await db!.delete(postVotes).where(eq(postVotes.postId, id));
    await db!.delete(posts).where(eq(posts.id, id));

    return c.json({ id });
  })

  // ── DELETE comment ──
  .delete("/:id/comments/:commentId", getUser, async (c) => {
    const user = c.var.user;
    const postId = Number(c.req.param("id"));
    const commentId = Number(c.req.param("commentId"));
    if (!Number.isInteger(postId) || !Number.isInteger(commentId)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    const [comment] = await db!.select().from(postComments)
      .where(and(eq(postComments.id, commentId), eq(postComments.postId, postId)));
    if (!comment) return c.json({ error: "Comment not found" }, 404);
    if (comment.userId !== user.id) return c.json({ error: "You can only delete your own comments" }, 403);

    await db!.delete(postComments).where(eq(postComments.id, commentId));
    // Floor at zero: a count that drifted negative would render as "-1 comments".
    await db!.update(posts)
      .set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, postId));

    return c.json({ id: commentId });
  });
