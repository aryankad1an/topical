import { hc } from "hono/client";
import { type ApiRoutes } from "@server/app";
import { queryOptions } from "@tanstack/react-query";
import type { DocFormat, LessonPlan } from "@/lib/types";
import { getDefaultCredential } from "@/lib/aiCredentials";

/**
 * Custom fetch used by the Hono client. For AI routes (`/api/ai/*`) it attaches
 * the user's default AI provider key/model from localStorage.
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === "string" ? input : (input as Request).url || input.toString();

  if (!urlStr.includes("/api/ai/")) {
    return fetch(input, init);
  }

  const credential = getDefaultCredential();
  const headers = new Headers(init?.headers);
  if (credential) {
    headers.set("X-AI-Provider", credential.provider);
    headers.set("X-AI-Model", credential.model);
    headers.set("X-AI-Api-Key", credential.apiKey);
  }

  // Errors are surfaced by the caller via ensureOk, so that each call site can
  // give the failure context. Toasting here too produced two toasts per
  // failure, with the caller's generic one landing on top of the useful one.
  return fetch(input, { ...init, headers });
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
    const body = await res.text().catch(() => "");
    // Both the Hono API and the FastAPI AI service report failures as
    // {"detail": "..."} / {"error": "..."}; surface that sentence rather than
    // the raw JSON, which used to be shown to users verbatim.
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.detail || parsed?.error || body;
    } catch {
      // Not JSON — use the body as-is.
    }
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

export interface ProfileUpdate {
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export async function updateProfile(update: ProfileUpdate) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  await ensureOk(res, "Failed to update profile");
  return res.json();
}

/** Upload an image file (avatar, etc.) and return its public URL. */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/files/upload", { method: "POST", body: fd });
  await ensureOk(res, "Upload failed");
  const { url } = (await res.json()) as { url: string };
  return url;
}

// ── AI ────────────────────────────────────────────────────────────────────

/**
 * POST to an AI route; `customFetch` attaches the user's provider credentials.
 *
 * Every AI call goes through here, so the JSON body, the headers and the error
 * unwrapping exist once. They used to be spread across three idioms — the Hono
 * RPC client, a LaTeX-only helper, and bare `fetch` — which is how the same
 * failure reached the user with three different messages.
 */
async function postAi(path: string, body: unknown, failure: string) {
  const res = await customFetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return ensureOk(res, failure);
}

/** The envelope both hierarchy endpoints return: a ```json fence inside JSON. */
export type HierarchyEnvelope = { status: string; data?: { topics?: string } };

/** Ask for a topic hierarchy for a subject the writer names. */
export async function searchTopics(query: string) {
  const res = await postAi("search-topics", { query }, "Failed to search topics");
  return res.json() as Promise<HierarchyEnvelope>;
}

/** Derive an outline from a draft that already exists. */
export async function outlineFromDocument(document: string, format: DocFormat) {
  const res = await postAi("outline-from-document", { document, format }, "Failed to outline this document");
  return res.json() as Promise<HierarchyEnvelope>;
}

/** Where a section's reference material comes from. */
export type GenerationSource = "web" | "llm" | "urls";

/** The wire body of a section request — one endpoint for every format/source. */
export interface SectionBody {
  topic: string;
  main_topic: string;
  format: DocFormat;
  source: GenerationSource;
  /** Pages to ground the section in. Read only when `source` is "urls". */
  urls?: string[];
  /** The whole outline as indented text, for cross-section awareness. */
  hierarchy?: string;
  /** Sub-sections written separately; a parent must not cover them. */
  children?: string[];
  /** Heading depth, so the section opens at the right level. */
  level?: number;
}

/** Write one section of a document. Returns the model's raw markup. */
export async function requestSection(body: SectionBody): Promise<string> {
  const res = await postAi("generate-section", body, "Failed to generate the section");
  return res.text();
}

export interface TransformRequest {
  action: string;
  selection: string;
  format: DocFormat;
  /** Free-text instruction; required for the `custom` action. */
  instruction?: string;
  /** Surrounding text, so the model matches the voice around the passage. */
  before?: string;
  after?: string;
  title?: string;
}

/** Rewrite, extend, or explain one passage. Returns the model's plain text. */
export async function transformSelection(req: TransformRequest): Promise<string> {
  const res = await postAi("transform", req, "The AI edit failed");
  return res.text();
}

/** One row of a model-proposed restructure, with its justification. */
export interface OutlineChange {
  title: string;
  kind: string;
  reason: string;
}

export interface RefinedOutline {
  summary: string;
  outline: { title: string; level: number }[];
  changes: OutlineChange[];
}

/** Ask for a better-organised outline, and the reasoning behind each move. */
export async function refineOutline(
  outline: { title: string; level: number }[],
  subject: string,
  instruction: string,
  format: DocFormat,
): Promise<RefinedOutline> {
  const res = await postAi(
    "refine-outline",
    { outline, subject, instruction, format },
    "Could not refine the outline",
  );
  return res.json() as Promise<RefinedOutline>;
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
    ? await api.lessonPlans[":id"].$put({ param: { id: lessonPlan.id.toString() }, json: lessonPlan })
    : await api.lessonPlans.$post({ json: lessonPlan });
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

async function getUserById(id: string) {
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

// ── People / public profiles ─────────────────────────────────────────────
export interface Person {
  id: string;
  username: string | null;
  givenName: string | null;
  familyName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

export interface PublishedDoc {
  id: number;
  name: string;
  mainTopic: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Browse profiles. An empty query lists everyone with a username. */
export async function fetchPeople(query = ""): Promise<Person[]> {
  const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
  await ensureOk(res, "Failed to load people");
  const data = await res.json();
  return data.people ?? [];
}

export async function fetchPersonProfile(
  username: string,
): Promise<{ person: Person; published: PublishedDoc[] }> {
  const res = await fetch(`/api/people/${encodeURIComponent(username)}`);
  await ensureOk(res, "Profile not found");
  return res.json();
}

/** Full display name, falling back to the handle. */
export function personName(p: Pick<Person, "givenName" | "familyName" | "username">): string {
  const full = [p.givenName, p.familyName].filter(Boolean).join(" ").trim();
  return full || p.username || "Member";
}
