import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";

const app = new Hono().basePath("/api");

// Enable CORS
app.use("*", cors());

// Debug endpoint - minimal, no dependencies
app.get("/debug", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasKindeDomain: !!process.env.KINDE_DOMAIN,
    hasKindeClientId: !!process.env.KINDE_CLIENT_ID,
    hasKindeClientSecret: !!process.env.KINDE_CLIENT_SECRET,
    hasKindeRedirectUri: !!process.env.KINDE_REDIRECT_URI,
    hasKindeLogoutRedirectUri: !!process.env.KINDE_LOGOUT_REDIRECT_URI,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });
});

// Lazy load routes only when needed
app.all("/*", async (c) => {
  const path = c.req.path;
  
  // Skip debug endpoint
  if (path === "/api/debug") {
    return c.notFound();
  }
  
  try {
    // Dynamic imports - only load when route is accessed
    const { authRoute } = await import("./server/routes/auth");
    const { topicsRoute } = await import("./server/routes/topics");
    const { ragRoute } = await import("./server/routes/rag");
    const { lessonPlansRoute } = await import("./server/routes/lessonPlans");
    
    // Create a new app with all routes for this request
    const fullApp = new Hono().basePath("/api");
    fullApp.use("*", cors());
    fullApp.route("/topics", topicsRoute);
    fullApp.route("/rag", ragRoute);
    fullApp.route("/lessonPlans", lessonPlansRoute);
    fullApp.route("/", authRoute);
    
    // Re-handle the request with the full app
    return fullApp.fetch(c.req.raw);
  } catch (error) {
    return c.json({
      error: "Failed to load routes",
      message: (error as Error).message,
      stack: (error as Error).stack,
    }, 500);
  }
});

// Export type for frontend
export type ApiRoutes = typeof app;

export default handle(app);
