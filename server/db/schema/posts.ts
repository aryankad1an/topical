import { text, pgTable, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from "zod";

export const posts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull().default("Anonymous"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  lessonPlanId: integer("lesson_plan_id"),   // optional attached lesson
  lessonPlanName: text("lesson_plan_name"),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postComments = pgTable("community_post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull().default("Anonymous"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postVotes = pgTable("community_post_votes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  vote: integer("vote").notNull(), // 1 = up, -1 = down
});

export const insertPostSchema = createInsertSchema(posts, {
  title: z.string().min(1),
  body: z.string().default(""),
});
export const selectPostSchema = createSelectSchema(posts);
export const insertCommentSchema = createInsertSchema(postComments, {
  body: z.string().min(1),
});
