/**
 * The HTTP surface: every API route, then the built frontend.
 *
 * `apiRoutes` is exported as a type so the browser client (`frontend/src/lib/api.ts`)
 * gets Hono's end-to-end typing of the routes it calls. The two `serveStatic`
 * lines are ordered deliberately — assets first, then a catch-all to
 * `index.html` so client-side routes survive a hard refresh.
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { authRoute } from "./routes/auth";
import { contentGenerationRoute } from "./routes/contentGeneration";
import { lessonPlansRoute } from "./routes/lessonPlans";
import { filesRoute } from "./routes/files";
import { postsRoute } from "./routes/posts";

const app = new Hono();

app.use("*", logger());

const apiRoutes = app.basePath("/api")
  .route("/ai", contentGenerationRoute)         // AI content generation (FastAPI proxy)
  .route("/lessonPlans", lessonPlansRoute)
  .route("/files", filesRoute)                 // secure file storage
  .route("/posts", postsRoute)
  .route("/", authRoute);

/**
 * Anything a handler throws becomes a JSON 500, logged with its route.
 *
 * Handlers used to wrap their own bodies in try/catch to achieve this, which
 * meant every one of them carried four lines of identical plumbing and the
 * ones that forgot answered with Hono's plain-text default — which the browser
 * client then showed to the user as an unparsed blob, because it expects the
 * `{ error }` shape every other failure uses.
 */
app.onError((error, c) => {
  console.error(`${c.req.method} ${c.req.path} failed:`, error);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

app.get("*", serveStatic({ root: "./frontend/dist" }));
app.get("*", serveStatic({ path: "./frontend/dist/index.html" }));

export default app;
export type ApiRoutes = typeof apiRoutes;
