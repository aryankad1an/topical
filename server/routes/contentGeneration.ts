import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";
import { z } from "zod";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8000";

export const contentGenerationRoute = new Hono()
  .all("*", getUser, async (c) => {
    // Forward the request to the FastAPI Python service
    const path = c.req.path.replace("/api", ""); // e.g. /rag/search-topics
    const url = `${RAG_SERVICE_URL}${path}`;

    try {
      const options: RequestInit = {
        method: c.req.method,
        headers: {
          "Content-Type": c.req.header("Content-Type") || "application/json",
        },
      };

      if (c.req.method !== "GET" && c.req.method !== "HEAD") {
        options.body = await c.req.text();
      }

      const response = await fetch(url, options);

      // Return the exact same response from Python FastAPI
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        return c.json(await response.json(), response.status as any);
      } else {
        return c.text(await response.text(), response.status as any);
      }
    } catch (err) {
      console.error("Error proxying to Python RAG service:", err);
      return c.json({ error: "Failed to connect to AI Content Service" }, 502);
    }
  });
