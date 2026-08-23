import { text, pgTable, serial, index, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * One generated section, as stored inside a lesson plan's `topics` array.
 *
 * This is the single definition of that shape: the table's `$type`, the API's
 * request validation, and the client's `SavedLessonTopic` all describe the
 * same object, and it used to be written out separately in each of the three.
 */
export const savedLessonTopicSchema = z.object({
  topic: z.string().min(1),
  mdxContent: z.string(),
  isSubtopic: z.boolean(),
  parentTopic: z.string().optional(),
  mainTopic: z.string().optional(),
});

export type SavedLessonTopic = z.infer<typeof savedLessonTopicSchema>;

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    mainTopic: text("main_topic").notNull(),
    topics: jsonb("topics").notNull().$type<SavedLessonTopic[]>(),
    coAuthors: jsonb("co_authors").$type<string[]>().default([]),
    isPublic: boolean("is_public").default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
  },
  (lessonPlans) => {
    return {
      userIdIndex: index("lesson_plans_user_id_idx").on(lessonPlans.userId),
      mainTopicIndex: index("lesson_plans_main_topic_idx").on(lessonPlans.mainTopic)
    };
  }
);

/**
 * What a client may send when creating or replacing a lesson plan.
 *
 * `userId` is deliberately absent — it comes from the session, never the body.
 * Plain zod rather than drizzle-zod's `createInsertSchema`, which inferred
 * every column as optional and so needed a cast back to drizzle's insert type
 * to be usable, on top of a second validation pass that duplicated this one.
 */
export const lessonPlanInputSchema = z.object({
  name: z.string().min(1, { message: "Lesson plan name must not be empty" }),
  mainTopic: z.string().min(1, { message: "Main topic must not be empty" }),
  topics: z.array(savedLessonTopicSchema),
  coAuthors: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().default(false),
});
