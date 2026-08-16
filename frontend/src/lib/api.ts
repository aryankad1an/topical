import { hc } from "hono/client";
import { type ApiRoutes } from "@server/app";
import { queryOptions } from "@tanstack/react-query";
import { LessonPlan } from "@/stores/lessonPlanStore";
import { toast } from "sonner";

/**
 * Custom fetch used by the Hono client. For AI routes (`/api/ai/*`) it attaches
 * the per-user Gemini key from localStorage and surfaces failures as toasts.
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === "string" ? input : (input as Request).url || input.toString();

  if (!urlStr.includes("/api/ai/")) {
    return fetch(input, init);
  }

  toast.info("Query submitted");

  const apiKey = localStorage.getItem("gemini_api_key") || "";
  const headers = new Headers(init?.headers);
  if (apiKey) headers.set("X-Gemini-API-Key", apiKey);

  try {
    const response = await fetch(input, { ...init, headers });
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null);
      const detail = body?.detail || "";
      if (response.status === 400 && detail.includes("No API key")) {
        toast.error("No API key configured. Go to Profile → AI Settings to add your Gemini API key.");
      } else {
        toast.error(detail || "Error connecting to Gemini API");
      }
    }
    return response;
  } catch (error) {
    toast.error("Error connecting to AI service");
    throw error;
  }
};

const client = hc<ApiRoutes>("/", { fetch: customFetch });

export const api = client.api;

/** Minimal shape shared by the Fetch `Response` and Hono's `ClientResponse`. */
type ResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

/** Throw a descriptive Error if a response isn't OK; otherwise return it. */
async function ensureOk<T extends ResponseLike>(res: T, message: string): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `${message} (${res.status} ${res.statusText})`);
  }
  return res;
}

// ── Current user ──────────────────────────────────────────────────────────

async function getCurrentUser() {
  const res = await api.me.$get();
  // 401 is expected for anonymous visitors — treat as a null session rather
  // than an error so react-query doesn't retry.
  if (res.status === 401) return { user: null };
  await ensureOk(res, "Failed to fetch current user");
  return res.json();
}

export const userQueryOptions = queryOptions({
  queryKey: ["get-current-user"],
  queryFn: getCurrentUser,
  staleTime: 1000 * 60 * 5,
  retry: false,
});

export async function updateUsername(username: string) {
  const res = await fetch("/api/username", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error || "Failed to update username");
  }
  return res.json();
}

// ── AI generation — MDX ───────────────────────────────────────────────────

/** Generate a topic hierarchy for a query. Returns the raw API envelope. */
export async function searchTopics(query: string, limit?: number) {
  const res = await api.ai["search-topics"].$post({ json: { query, limit } });
  await ensureOk(res, "Failed to search topics");
  return res.json();
}

export async function generateSingleTopicRaw(selectedTopic: string, mainTopic: string, numResults?: number, hierarchy?: string) {
  const res = await api.ai["single-topic-raw"].$post({
    json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, num_results: numResults, hierarchy },
  });
  await ensureOk(res, "Failed to generate MDX content");
  return res.text();
}

export async function generateMdxLlmOnlyRaw(selectedTopic: string, mainTopic: string, hierarchy?: string) {
  const res = await api.ai["generate-mdx-llm-only-raw"].$post({
    json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy },
  });
  await ensureOk(res, "Failed to generate MDX content");
  return res.text();
}

export async function generateMdxFromUrlsRaw(urls: string[], selectedTopic: string, mainTopic: string, topic?: string, useLlmKnowledge?: boolean, hierarchy?: string) {
  const res = await api.ai["generate-mdx-from-urls-raw"].$post({
    json: { urls, selected_topic: selectedTopic, main_topic: mainTopic, topic, use_llm_knowledge: useLlmKnowledge, hierarchy },
  });
  await ensureOk(res, "Failed to generate MDX from URLs");
  return res.text();
}

// ── AI generation — LaTeX ─────────────────────────────────────────────────

async function postLatexRaw(path: string, body: unknown): Promise<string> {
  const res = await customFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await ensureOk(res, "Failed to generate LaTeX");
  return res.text();
}

export function generateLatexLlmOnlyRaw(selectedTopic: string, mainTopic: string, hierarchy?: string) {
  return postLatexRaw("/api/ai/generate-latex-llm-only-raw", {
    selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy,
  });
}

export function generateLatexCrawlRaw(selectedTopic: string, mainTopic: string, hierarchy?: string) {
  return postLatexRaw("/api/ai/generate-latex-crawl-raw", {
    selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy,
  });
}

export function generateLatexFromUrlsRaw(urls: string[], selectedTopic: string, mainTopic: string, hierarchy?: string) {
  return postLatexRaw("/api/ai/generate-latex-from-urls-raw", {
    urls, selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy,
  });
}

// ── Lesson plans ──────────────────────────────────────────────────────────

export type LessonPlanResponse = {
  id: number;
  userId: string;
  name: string;
  mainTopic: string;
  topics: {
    topic: string;
    mdxContent: string;
    isSubtopic: boolean;
    parentTopic?: string;
    mainTopic?: string;
  }[];
  coAuthors?: string[];
  authorUsername?: string;
  coAuthorUsernames?: string[];
  isPublic: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ErrorResponse = { error: string };

/** Create a new lesson plan, or update it in place when it already has an id. */
export async function saveLessonPlan(lessonPlan: LessonPlan) {
  const res = lessonPlan.id
    ? await api.lessonPlans[":id"].$put({ param: { id: lessonPlan.id.toString() }, json: lessonPlan } as any)
    : await api.lessonPlans.$post({ json: lessonPlan } as any);
  await ensureOk(res, "Failed to save lesson plan");
  return res.json();
}

export async function getLessonPlans() {
  const res = await api.lessonPlans.$get();
  await ensureOk(res, "Failed to get lesson plans");
  return res.json();
}

export async function getLessonPlanById(id: number): Promise<LessonPlanResponse | ErrorResponse> {
  try {
    const res = await api.lessonPlans[":id"].$get({ param: { id: String(id) } });
    await ensureOk(res, `Failed to get lesson plan ${id}`);
    return (await res.json()) as LessonPlanResponse;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteLessonPlan(id: number) {
  const res = await api.lessonPlans[":id"].$delete({ param: { id: String(id) } });
  await ensureOk(res, "Failed to delete lesson plan");
  return true;
}

export async function getPublicLessonPlans() {
  const res = await api.lessonPlans.public.$get();
  await ensureOk(res, "Failed to get public lesson plans");
  return res.json();
}

export async function getPublicLessonPlanById(id: number): Promise<LessonPlanResponse | ErrorResponse> {
  try {
    const res = await api.lessonPlans.public[":id"].$get({ param: { id: String(id) } });
    await ensureOk(res, `Failed to get public lesson plan ${id}`);
    return (await res.json()) as LessonPlanResponse;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Users ─────────────────────────────────────────────────────────────────

export async function searchUsername(query: string) {
  try {
    const res = await fetch(`/api/search/username?q=${encodeURIComponent(query)}`);
    await ensureOk(res, "Failed to search users");
    const data = await res.json();
    return data.users;
  } catch {
    return [];
  }
}

export async function getUserById(id: string) {
  try {
    const res = await api["user"][":id"].$get({ param: { id } });
    await ensureOk(res, "Failed to fetch user");
    const data = await res.json();
    return "user" in data ? data.user : null;
  } catch {
    return null;
  }
}

export const userByIdQueryOptions = (id: string) => queryOptions({
  queryKey: ["user", id],
  queryFn: () => getUserById(id),
  staleTime: 1000 * 60 * 60,
  enabled: !!id,
});
