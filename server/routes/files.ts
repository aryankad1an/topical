/**
 * Uploaded images: storing them, and serving them back.
 *
 * The set of formats the app accepts is declared once, in `IMAGE_TYPES`.
 * It used to be spelled out three times — a MIME→extension map for uploads,
 * its inverse for serving, and a third copy inside the filename regex — so
 * adding a format meant editing three places and forgetting one meant files
 * that uploaded fine and then would not load.
 */

import { Hono } from "hono";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import { getUser } from "../kinde";

/** Uploads live outside the source tree and are gitignored. */
const UPLOADS_DIR = join(process.cwd(), "server", "uploads");

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SIZE_LABEL = "5MB";

/** The formats accepted, as MIME type → the extension stored on disk. */
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;

type Extension = (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES];

/** Extension → MIME type, derived rather than written out a second time. */
const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([mime, ext]) => [ext, mime]),
) as Record<Extension, string>;

/**
 * The only shape a stored filename can have: 32 hex characters from
 * `randomBytes(16)`, then one of the extensions above.
 *
 * This is the path-traversal guard, so it is built from the same table the
 * upload writes with — a regex listing formats by hand could fall behind it
 * and reject files this server had itself created.
 */
const STORED_NAME = new RegExp(
  `^[a-f0-9]{32}\\.(${Object.values(IMAGE_TYPES).join("|")})$`,
);

const ACCEPTED_LABEL = Object.values(IMAGE_TYPES).join(", ");

// Created once at startup; `recursive` makes a second run harmless.
if (!existsSync(UPLOADS_DIR)) {
  mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
}

export const filesRoute = new Hono()
  // ── Upload ──
  .post("/upload", getUser, async (c) => {
    try {
      const field = (await c.req.parseBody())["file"];
      if (!field || typeof field === "string" || Array.isArray(field)) {
        return c.json({ error: "No file provided" }, 400);
      }

      const file = field as File;
      const extension = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
      if (!extension) {
        return c.json(
          { error: `Unsupported file type: ${file.type}. Allowed: ${ACCEPTED_LABEL}` },
          400,
        );
      }

      const bytes = await file.arrayBuffer();
      if (bytes.byteLength > MAX_SIZE_BYTES) {
        return c.json({ error: `File too large. Maximum size is ${MAX_SIZE_LABEL}` }, 400);
      }

      // A random name, not the uploaded one: the client's filename is
      // attacker-controlled and would otherwise reach `join()`.
      const filename = `${randomBytes(16).toString("hex")}.${extension}`;
      await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes));

      // The URL that goes into the document.
      return c.json({ url: `/api/files/${filename}`, filename, size: bytes.byteLength });
    } catch (error) {
      console.error("File upload error:", error);
      return c.json({ error: "Upload failed" }, 500);
    }
  })

  // ── Serve ──
  .get("/:filename", async (c) => {
    const filename = c.req.param("filename");
    if (!STORED_NAME.test(filename)) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const file = Bun.file(join(UPLOADS_DIR, filename));
    if (!(await file.exists())) {
      return c.json({ error: "File not found" }, 404);
    }

    const extension = filename.split(".").pop() as Extension;
    return new Response(file, {
      headers: {
        "Content-Type": MIME_BY_EXTENSION[extension],
        // The name is a content hash-shaped random id and is never reused, so
        // the file at a given URL can never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });
