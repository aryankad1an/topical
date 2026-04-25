import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Gemini client — graceful if API key is missing
// ---------------------------------------------------------------------------
const GOOGLE_API_KEY = process.env.GOOGLE_AI_API_KEY || "";

let genAI: GoogleGenerativeAI | null = null;
if (GOOGLE_API_KEY) {
  genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
} else {
  console.warn(
    "⚠️  GOOGLE_AI_API_KEY is not set. Content generation will return placeholder content.\n" +
    "   Get a free key at https://aistudio.google.com/app/apikey and add it to your .env file.\n"
  );
}

function getModel() {
  if (!genAI) throw new Error("GOOGLE_AI_API_KEY is not configured");
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const searchTopicsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional(),
});

const generateMdxSchema = z.object({
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  num_results: z.number().optional(),
});

const urlMdxSchema = z.object({
  url: z.string().url(),
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  use_llm_knowledge: z.boolean().optional(),
});

const urlsMdxSchema = z.object({
  urls: z.array(z.string().url()),
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  use_llm_knowledge: z.boolean().optional(),
});

const refineSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
});

const refineWithSelectionSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  direct_replacement: z.string().optional(),
});

const refineWithCrawlingSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  num_results: z.number().optional(),
});

const refineWithUrlsSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  urls: z.array(z.string().url()),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch a URL and return its plain-text content (best-effort) */
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TopicalBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Strip HTML tags crudely – good enough as LLM context
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 15000); // cap to keep prompt manageable
  } catch {
    return "";
  }
}

/** Build a placeholder hierarchy when Gemini is not configured */
function placeholderHierarchy(topic: string) {
  return [
    { topic: `Introduction to ${topic}`, subtopics: ["Overview", "Key Concepts", "History"], relevanceScore: 95 },
    { topic: `Core Principles of ${topic}`, subtopics: ["Fundamental Theory", "Best Practices"], relevanceScore: 90 },
    { topic: `Advanced ${topic}`, subtopics: ["Advanced Topics", "Case Studies"], relevanceScore: 80 },
    { topic: `${topic} in Practice`, subtopics: ["Real-world Examples", "Tools & Ecosystem"], relevanceScore: 85 },
  ];
}

/** Optimize a vague topic query into a precise learning objective before generation */
async function optimizePrompt(rawTopic: string): Promise<string> {
  if (!genAI) return rawTopic;
  try {
    const model = getModel();
    const result = await model.generateContent(
      `Convert this topic into a precise educational learning objective in 5-10 words. ` +
      `Return ONLY the optimized topic name, nothing else. Topic: "${rawTopic}"`
    );
    const optimized = result.response.text().trim().replace(/^["']|["']$/g, "");
    return optimized || rawTopic;
  } catch {
    return rawTopic;
  }
}

/** Build placeholder MDX when Gemini is not configured */
function placeholderMdx(topic: string, mainTopic: string) {
  return `# ${topic}

> This is placeholder content. Add your **GOOGLE_AI_API_KEY** to \`.env\` to enable AI-powered content generation.

## Overview

This section covers **${topic}** as part of the broader **${mainTopic}** lesson plan.

## Key Points

- Point one about ${topic}
- Point two about ${topic}
- Point three about ${topic}

## Summary

Add your Google AI API key to unlock automatic MDX generation for this topic.
`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const contentGenerationRoute = new Hono()

  // ── Search Topics ──────────────────────────────────────────────────────────
  .post("/search-topics", getUser, zValidator("json", searchTopicsSchema), async (c) => {
    const { query } = c.req.valid("json");

    if (!genAI) {
      const hierarchy = placeholderHierarchy(query);
      const json = JSON.stringify(hierarchy, null, 2);
      return c.json({
        status: "success",
        data: { topics: "```json\n" + json + "\n```" },
      });
    }

    try {
      const model = getModel();
      const prompt = `Generate a structured topic hierarchy for learning about "${query}".

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
[
  {
    "topic": "Main topic name",
    "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
  }
]

Rules:
- 4-6 main topics
- 2-4 subtopics each
- Topics should progress logically from basics to advanced
- Topic names should be clear and descriptive`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip any accidental markdown fences
      let clean = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(clean); // validate it's real JSON

      // Add relevance scores if missing
      const scored = parsed.map((item: any, i: number) => ({
        ...item,
        relevanceScore: item.relevanceScore ?? Math.max(60, 95 - i * 5),
      }));
      clean = JSON.stringify(scored, null, 2);

      return c.json({
        status: "success",
        data: { topics: "```json\n" + clean + "\n```" },
      });
    } catch (err) {
      console.error("search-topics error:", err);
      const hierarchy = placeholderHierarchy(query);
      return c.json({
        status: "success",
        data: { topics: "```json\n" + JSON.stringify(hierarchy, null, 2) + "\n```" },
      });
    }
  })

  // ── Generate MDX (LLM only) — JSON response ─────────────────────────────
  .post("/generate-mdx-llm-only", getUser, zValidator("json", generateMdxSchema), async (c) => {
    const { selected_topic, main_topic } = c.req.valid("json");

    if (!genAI) {
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }

    try {
      const optimizedTopic = await optimizePrompt(selected_topic);
      const mdx = await generateMdxContent(optimizedTopic, main_topic, "");
      return c.json({ status: "success", data: { mdx_content: mdx } });
    } catch (err) {
      console.error("generate-mdx-llm-only error:", err);
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }
  })

  // ── Generate MDX (LLM only) — raw text response ──────────────────────────
  .post("/generate-mdx-llm-only-raw", getUser, zValidator("json", generateMdxSchema), async (c) => {
    const { selected_topic, main_topic } = c.req.valid("json");

    if (!genAI) {
      return c.text(placeholderMdx(selected_topic, main_topic));
    }

    try {
      const optimizedTopic = await optimizePrompt(selected_topic);
      const mdx = await generateMdxContent(optimizedTopic, main_topic, "");
      return c.text(mdx);
    } catch (err) {
      console.error("generate-mdx-llm-only-raw error:", err);
      return c.text(placeholderMdx(selected_topic, main_topic));
    }
  })

  // ── Single topic (crawl) — JSON ──────────────────────────────────────────
  .post("/single-topic", getUser, zValidator("json", generateMdxSchema), async (c) => {
    const { selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) {
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }
    try {
      const mdx = await generateMdxContent(selected_topic, main_topic, "");
      return c.json({ status: "success", data: { mdx_content: mdx } });
    } catch (err) {
      console.error("single-topic error:", err);
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }
  })

  // ── Single topic (crawl) — raw ───────────────────────────────────────────
  .post("/single-topic-raw", getUser, zValidator("json", generateMdxSchema), async (c) => {
    const { selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) return c.text(placeholderMdx(selected_topic, main_topic));
    try {
      const mdx = await generateMdxContent(selected_topic, main_topic, "");
      return c.text(mdx);
    } catch (err) {
      console.error("single-topic-raw error:", err);
      return c.text(placeholderMdx(selected_topic, main_topic));
    }
  })

  // ── Generate from URL — JSON ─────────────────────────────────────────────
  .post("/generate-mdx-from-url", zValidator("json", urlMdxSchema), async (c) => {
    const { url, selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    try {
      const context = await fetchUrlContent(url);
      const mdx = await generateMdxContent(selected_topic, main_topic, context);
      return c.json({ status: "success", data: { mdx_content: mdx } });
    } catch (err) {
      console.error("generate-mdx-from-url error:", err);
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }
  })

  // ── Generate from URL — raw ──────────────────────────────────────────────
  .post("/generate-mdx-from-url-raw", zValidator("json", urlMdxSchema), async (c) => {
    const { url, selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) return c.text(placeholderMdx(selected_topic, main_topic));
    try {
      const context = await fetchUrlContent(url);
      const mdx = await generateMdxContent(selected_topic, main_topic, context);
      return c.text(mdx);
    } catch (err) {
      console.error("generate-mdx-from-url-raw error:", err);
      return c.text(placeholderMdx(selected_topic, main_topic));
    }
  })

  // ── Generate from multiple URLs — JSON ───────────────────────────────────
  .post("/generate-mdx-from-urls", zValidator("json", urlsMdxSchema), async (c) => {
    const { urls, selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    try {
      const contents = await Promise.all(urls.map(fetchUrlContent));
      const context = contents.filter(Boolean).join("\n\n---\n\n").slice(0, 20000);
      const mdx = await generateMdxContent(selected_topic, main_topic, context);
      return c.json({ status: "success", data: { mdx_content: mdx } });
    } catch (err) {
      console.error("generate-mdx-from-urls error:", err);
      return c.json({ status: "success", data: { mdx_content: placeholderMdx(selected_topic, main_topic) } });
    }
  })

  // ── Generate from multiple URLs — raw ────────────────────────────────────
  .post("/generate-mdx-from-urls-raw", zValidator("json", urlsMdxSchema), async (c) => {
    const { urls, selected_topic, main_topic } = c.req.valid("json");
    if (!genAI) return c.text(placeholderMdx(selected_topic, main_topic));
    try {
      const contents = await Promise.all(urls.map(fetchUrlContent));
      const context = contents.filter(Boolean).join("\n\n---\n\n").slice(0, 20000);
      const mdx = await generateMdxContent(selected_topic, main_topic, context);
      return c.text(mdx);
    } catch (err) {
      console.error("generate-mdx-from-urls-raw error:", err);
      return c.text(placeholderMdx(selected_topic, main_topic));
    }
  })

  // ── Refine (basic) ───────────────────────────────────────────────────────
  .post("/refine", getUser, zValidator("json", refineSchema), async (c) => {
    const { mdx, question } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: mdx } });
    try {
      const refined = await refineMdxContent(mdx, "", question, "");
      return c.json({ status: "success", data: { mdx_content: refined } });
    } catch (err) {
      console.error("refine error:", err);
      return c.json({ status: "success", data: { mdx_content: mdx } });
    }
  })

  // ── Refine with selection — JSON ─────────────────────────────────────────
  .post("/refine-with-selection", getUser, zValidator("json", refineWithSelectionSchema), async (c) => {
    const { mdx, question, selected_text, topic } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: mdx } });
    try {
      const refined = await refineMdxContent(mdx, selected_text, question, topic);
      return c.json({ status: "success", data: { mdx_content: refined } });
    } catch (err) {
      return c.json({ status: "success", data: { mdx_content: mdx } });
    }
  })

  // ── Refine with selection — raw ──────────────────────────────────────────
  .post("/refine-with-selection-raw", getUser, zValidator("json", refineWithSelectionSchema), async (c) => {
    const { mdx, question, selected_text, topic } = c.req.valid("json");
    if (!genAI) return c.text(mdx);
    try {
      const refined = await refineMdxContent(mdx, selected_text, question, topic);
      return c.text(refined);
    } catch (err) {
      return c.text(mdx);
    }
  })

  // ── Refine with crawling — JSON ──────────────────────────────────────────
  .post("/refine-with-crawling", getUser, zValidator("json", refineWithCrawlingSchema), async (c) => {
    const { mdx, question, selected_text, topic } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: mdx } });
    try {
      const refined = await refineMdxContent(mdx, selected_text, question, topic);
      return c.json({ status: "success", data: { mdx_content: refined } });
    } catch (err) {
      return c.json({ status: "success", data: { mdx_content: mdx } });
    }
  })

  // ── Refine with crawling — raw ───────────────────────────────────────────
  .post("/refine-with-crawling-raw", getUser, zValidator("json", refineWithCrawlingSchema), async (c) => {
    const { mdx, question, selected_text, topic } = c.req.valid("json");
    if (!genAI) return c.text(mdx);
    try {
      const refined = await refineMdxContent(mdx, selected_text, question, topic);
      return c.text(refined);
    } catch (err) {
      return c.text(mdx);
    }
  })

  // ── Refine with URLs — JSON ──────────────────────────────────────────────
  .post("/refine-with-urls", getUser, zValidator("json", refineWithUrlsSchema), async (c) => {
    const { mdx, question, selected_text, topic, urls } = c.req.valid("json");
    if (!genAI) return c.json({ status: "success", data: { mdx_content: mdx } });
    try {
      const contents = await Promise.all(urls.map(fetchUrlContent));
      const context = contents.filter(Boolean).join("\n\n---\n\n").slice(0, 15000);
      const refined = await refineMdxContent(mdx, selected_text, question, topic, context);
      return c.json({ status: "success", data: { mdx_content: refined } });
    } catch (err) {
      return c.json({ status: "success", data: { mdx_content: mdx } });
    }
  })

  // ── Refine with URLs — raw ───────────────────────────────────────────────
  .post("/refine-with-urls-raw", getUser, zValidator("json", refineWithUrlsSchema), async (c) => {
    const { mdx, question, selected_text, topic, urls } = c.req.valid("json");
    if (!genAI) return c.text(mdx);
    try {
      const contents = await Promise.all(urls.map(fetchUrlContent));
      const context = contents.filter(Boolean).join("\n\n---\n\n").slice(0, 15000);
      const refined = await refineMdxContent(mdx, selected_text, question, topic, context);
      return c.text(refined);
    } catch (err) {
      return c.text(mdx);
    }
  });

// ---------------------------------------------------------------------------
// Core LLM helpers
// ---------------------------------------------------------------------------

async function generateMdxContent(
  topic: string,
  mainTopic: string,
  context: string
): Promise<string> {
  const model = getModel();

  const contextBlock = context
    ? `\nUse the following reference material to inform your content:\n<context>\n${context}\n</context>\n`
    : "";

  const prompt = `You are an expert technical writer creating educational MDX content.

Generate comprehensive MDX content for the topic: "${topic}"
This is part of a lesson plan about: "${mainTopic}"
${contextBlock}
Requirements:
- Write in MDX format (Markdown with optional JSX — but keep it simple, no custom components)
- Start with a level-1 heading: # ${topic}
- Include 3-5 main sections with ## headings
- Use bullet points, numbered lists, and code blocks where appropriate
- Be educational, clear, and well-structured
- Length: 400-800 words
- Do NOT include frontmatter (no --- blocks)
- Return ONLY the MDX content, nothing else`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function refineMdxContent(
  fullMdx: string,
  selectedText: string,
  question: string,
  topic: string,
  context: string = ""
): Promise<string> {
  const model = getModel();

  const contextBlock = context
    ? `\nAdditional reference material:\n<context>\n${context}\n</context>\n`
    : "";

  const selectionBlock = selectedText
    ? `\nThe user has selected this specific text to refine:\n<selected>\n${selectedText}\n</selected>\n`
    : "";

  const prompt = `You are an expert technical writer refining educational MDX content.

Topic: "${topic}"
${selectionBlock}
User's refinement request: "${question}"
${contextBlock}
Here is the full MDX document:
<document>
${fullMdx}
</document>

${selectedText
    ? `Rewrite ONLY the selected text according to the user's request, then return the COMPLETE document with that section replaced. Keep all other content identical.`
    : `Refine the entire document according to the user's request.`
  }

Return ONLY the complete updated MDX document, nothing else.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
