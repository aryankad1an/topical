import { Hono } from "hono";
import { getUser } from "../kinde";
import { join } from "path";
import { mkdir, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { randomBytes } from "crypto";

// Store uploads in server/uploads (gitignored)
const UPLOADS_DIR = join(process.cwd(), "server", "uploads");

// Ensure uploads directory exists on startup
async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}
ensureUploadsDir().catch(console.error);

// Allowed MIME types for security
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const filesRoute = new Hono()

  // ── Upload a file ──────────────────────────────────────────────────────────
  .post("/upload", getUser, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body["file"];

      if (!file || typeof file === "string" || Array.isArray(file)) {
        return c.json({ error: "No file provided" }, 400);
      }

      // At this point file is a Blob/File
      const uploadedFile = file as File;

      // Validate MIME type
      const mimeType = uploadedFile.type;
      const ext = ALLOWED_TYPES[mimeType];
      if (!ext) {
        return c.json(
          { error: `Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP, SVG` },
          400
        );
      }

      // Validate size
      const arrayBuffer = await uploadedFile.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
        return c.json({ error: "File too large. Maximum size is 5MB" }, 400);
      }

      // Generate a unique filename to prevent path traversal attacks
      const uniqueName = randomBytes(16).toString("hex") + ext;
      const filePath = join(UPLOADS_DIR, uniqueName);

      await writeFile(filePath, Buffer.from(arrayBuffer));

      // Return the URL that can be used in MDX content
      const url = `/api/files/${uniqueName}`;
      return c.json({ url, filename: uniqueName, size: arrayBuffer.byteLength });
    } catch (err) {
      console.error("File upload error:", err);
      return c.json({ error: "Upload failed" }, 500);
    }
  })

  // ── Serve an uploaded file ─────────────────────────────────────────────────
  .get("/:filename", async (c) => {
    const filename = c.req.param("filename");

    // Security: only allow alphanumeric + hyphens + dots, no path traversal
    if (!/^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = join(UPLOADS_DIR, filename);

    try {
      await stat(filePath); // check it exists
      const fileData = await Bun.file(filePath).arrayBuffer();

      // Determine content-type from extension
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
      };
      const contentType = mimeMap[ext ?? ""] ?? "application/octet-stream";

      return new Response(fileData, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return c.json({ error: "File not found" }, 404);
    }
  });
