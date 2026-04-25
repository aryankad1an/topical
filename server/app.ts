import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { authRoute } from "./routes/auth";
import { topicsRoute } from "./routes/topics";
import { contentGenerationRoute } from "./routes/contentGeneration";
import { lessonPlansRoute } from "./routes/lessonPlans";
import { filesRoute } from "./routes/files";

const app = new Hono();

app.use("*", logger());

const apiRoutes = app.basePath("/api")
  .route("/topics", topicsRoute)
  .route("/rag", contentGenerationRoute)       // content generation (kept /rag for frontend compat)
  .route("/lessonPlans", lessonPlansRoute)
  .route("/files", filesRoute)                 // secure file storage
  .route("/", authRoute);

app.get("*", serveStatic({ root: "./frontend/dist" }));
app.get("*", serveStatic({ path: "./frontend/dist/index.html" }));

export default app;
export type ApiRoutes = typeof apiRoutes;
