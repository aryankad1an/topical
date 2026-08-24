/**
 * The community forum: posts, votes and comments.
 *
 * Nothing here is linked at the schema level — votes and comments carry a
 * `postId` with no foreign key behind it — so each handler that writes one
 * checks the post exists first, and deleting a post takes its votes and
 * comments with it. An orphaned row is invisible and permanent.
 */

import { Hono } from "hono";
import { getUser } from "../kinde";
import { db } from "../db";
import { posts, postComments, postVotes } from "../db/schema/posts";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireDb } from "../middleware";
import { authorName as displayName, idParam } from "../http";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).default(""),
  lessonPlanId: z.number().optional(),
  lessonPlanName: z.string().optional(),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

/** A user's standing vote on a post: up, down, or none. */
type VoteValue = 1 | -1 | 0;

/** 1 when this vote counts toward `side`'s tally, else 0. */
const tally = (value: VoteValue, side: 1 | -1): number => (value === side ? 1 : 0);

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
    const authorName = displayName(user);
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
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid post id" }, 400);
    const [post] = await db!.select().from(posts).where(eq(posts.id, id));
    if (!post) return c.json({ error: "Not found" }, 404);
    const comments = await db!.select().from(postComments)
      .where(eq(postComments.postId, id))
      .orderBy(desc(postComments.createdAt));
    return c.json({ post, comments });
  })

  // ── VOTE ──
  // Voting the same way twice clears the vote; voting the other way switches
  // it. Both counters are then adjusted by the difference between the old
  // state and the new one, in a single statement — this used to be a nested
  // if/else over six near-identical UPDATEs, one per transition, and the two
  // "switch" branches were the only ones that touched both columns.
  .post("/:id/vote", getUser, zValidator("json", z.object({ vote: z.union([z.literal(1), z.literal(-1)]) })), async (c) => {
    const user = c.var.user;
    const postId = idParam(c.req.param("id"));
    if (postId === null) return c.json({ error: "Invalid post id" }, 400);
    const { vote } = c.req.valid("json");

    const [target] = await db!.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
    if (!target) return c.json({ error: "Post not found" }, 404);

    const [existing] = await db!.select().from(postVotes)
      .where(and(eq(postVotes.postId, postId), eq(postVotes.userId, user.id)));

    const before: VoteValue = existing ? (existing.vote as 1 | -1) : 0;
    const after: VoteValue = before === vote ? 0 : vote;

    if (after === 0) {
      await db!.delete(postVotes).where(eq(postVotes.id, existing.id));
    } else if (existing) {
      await db!.update(postVotes).set({ vote: after }).where(eq(postVotes.id, existing.id));
    } else {
      await db!.insert(postVotes).values({ postId, userId: user.id, vote: after });
    }

    const [updated] = await db!.update(posts)
      .set({
        // GREATEST floors at zero: a count that drifted negative — which a
        // half-applied vote in the old branching version could do — renders
        // as "-1 upvotes".
        upvotes: sql`GREATEST(${posts.upvotes} + ${tally(after, 1) - tally(before, 1)}, 0)`,
        downvotes: sql`GREATEST(${posts.downvotes} + ${tally(after, -1) - tally(before, -1)}, 0)`,
      })
      .where(eq(posts.id, postId))
      .returning();

    return c.json({ post: updated });
  })

  // ── ADD COMMENT ──
  .post("/:id/comments", getUser, zValidator("json", createCommentSchema), async (c) => {
    const user = c.var.user;
    const postId = idParam(c.req.param("id"));
    if (postId === null) return c.json({ error: "Invalid post id" }, 400);
    const { body } = c.req.valid("json");
    const authorName = displayName(user);

    // Same reason as voting: an orphaned comment is invisible but permanent.
    const [target] = await db!.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
    if (!target) return c.json({ error: "Post not found" }, 404);

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
    const id = idParam(c.req.param("id"));
    if (id === null) return c.json({ error: "Invalid post id" }, 400);

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
    const postId = idParam(c.req.param("id"));
    const commentId = idParam(c.req.param("commentId"));
    if (postId === null || commentId === null) {
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
