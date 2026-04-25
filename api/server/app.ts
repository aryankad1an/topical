import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { authRoute } from "./routes/auth";
import { topicsRoute } from "./routes/topics";
import { ragRoute } from "./routes/rag";
import { lessonPlansRoute } from "./routes/lessonPlans";

const app = new Hono();

app.use("*", logger());

const apiRoutes = app.basePath("/api")
  .route("/topics", topicsRoute)
  .route("/rag", ragRoute)  // Add the RAG route
  .route("/lessonPlans", lessonPlansRoute)  // Add the lesson plans route
  .route("/", authRoute);


app.get("*", serveStatic({ root: "./frontend/dist" }));
app.get("*", serveStatic({ path: "./frontend/dist/index.html" }));

export default app;
export type ApiRoutes = typeof apiRoutes
