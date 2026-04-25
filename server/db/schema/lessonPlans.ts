import { text, pgTable, serial, index, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from "zod";

// Define the saved lesson topic schema
const savedLessonTopicSchema = z.object({
  topic: z.string().min(1),
  mdxContent: z.string(),
  isSubtopic: z.boolean(),
  parentTopic: z.string().optional(),
  mainTopic: z.string().optional()
});

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    mainTopic: text("main_topic").notNull(),
    topics: jsonb("topics").notNull().$type<{
      topic: string;
      mdxContent: string;
      isSubtopic: boolean;
      parentTopic?: string;
      mainTopic?: string;
    }[]>(),
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

// Schema for inserting a lesson plan - can be used to validate API requests
export const insertLessonPlanSchema = createInsertSchema(lessonPlans, {
  name: z.string().min(1, { message: "Lesson plan name must not be empty" }),
  mainTopic: z.string().min(1, { message: "Main topic must not be empty" }),
  topics: z.array(savedLessonTopicSchema),
  isPublic: z.boolean().default(false)
});

// Schema for selecting a lesson plan - can be used to validate API responses
export const selectLessonPlanSchema = createSelectSchema(lessonPlans);
