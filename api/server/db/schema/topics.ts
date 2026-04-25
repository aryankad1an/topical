import { text, pgTable, serial, index, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from "zod";

export const topics = pgTable(
    "topics",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id").notNull(),
        axiosWing: text("axios_wing").notNull(),
        topic: text("topic").notNull(),
        difficulty: text("difficulty").notNull().default("Beginner"),
        mdxContent: text("mdx_content").notNull(),
        // New fields for topic relationships
        mainTopic: text("main_topic"),
        parentTopic: text("parent_topic"),
        isSubtopic: boolean("is_subtopic").default(false),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow()
    },
    (topics) => {
        return {
            userIdIndex: index("user_id_idx").on(topics.userId),
            axiosWingIndex: index("axios_wing_idx").on(topics.axiosWing),
            mainTopicIndex: index("topics_main_topic_idx").on(topics.mainTopic),
            parentTopicIndex: index("topics_parent_topic_idx").on(topics.parentTopic)
        };
    }
);

// Schema for inserting a topic - can be used to validate API requests
export const insertTopicSchema = createInsertSchema(topics, {
    axiosWing: z.string().min(1, { message: "Axios Wing must not be empty" }),
    topic: z.string().min(3, { message: "Topic must be at least 3 characters" }),
    difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
    mdxContent: z.string().min(10, { message: "Lecture notes must be at least 10 characters" }),
    // Make the new fields optional in the schema
    mainTopic: z.string().optional(),
    parentTopic: z.string().optional(),
    isSubtopic: z.boolean().optional()
});

// Schema for selecting a Topic - can be used to validate API responses
export const selectTopicSchema = createSelectSchema(topics);