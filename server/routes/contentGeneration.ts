import { Hono } from "hono";
import { getUser } from "../kinde";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

export const contentGenerationRoute = new Hono()
  .all("*", getUser, async (c) => {
    // Forward requests to the FastAPI Python AI content service
    const path = c.req.path.replace("/api", ""); // e.g. /ai/search-topics
    const url = `${AI_SERVICE_URL}${path}`;

    try {
      const options: RequestInit = {
        method: c.req.method,
        headers: {
          "Content-Type": c.req.header("Content-Type") || "application/json",
          "X-Gemini-API-Key": c.req.header("X-Gemini-API-Key") || "",
        },
        signal: AbortSignal.timeout(90_000), // 90s — URL crawl + Gemini generation can be slow
      };

      if (c.req.method !== "GET" && c.req.method !== "HEAD") {
        options.body = await c.req.text();
      }

      const response = await fetch(url, options);

      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        return c.json(await response.json(), response.status as any);
      } else {
        return c.text(await response.text(), response.status as any);
      }
    } catch (err) {
      console.error("Error proxying to AI content service:", err);
      return c.json({ error: "Failed to connect to AI Content Service" }, 502);
    }
  });
