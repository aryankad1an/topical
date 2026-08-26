import { queryOptions } from "@tanstack/react-query";
import type { DocFormat, LessonPlan } from "@/lib/types";
import { getDefaultCredential } from "@/lib/aiCredentials";

/**
 * The HTTP client every call in this file goes through.
 *
 * It replaced Hono's RPC client, which typed the routes end-to-end by importing
 * the server's own route definitions — an arrangement that only works while
 * the server is TypeScript. The backend is Python now, so the types live here
 * instead, next to the functions that return them, and the request plumbing
 * (JSON body, credentials, error unwrapping) exists once rather than at each
 * call site.
 */

/** Everything the API is reached at. Relative, so Vite's proxy and the
 *  production server (which serves this bundle itself) both work unchanged. */
const API_BASE = "/api";

interface RequestOptions {
  method?: string;
  /** Serialised as JSON. Use `form` for multipart instead. */
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined>;
  /** Attach the user's own AI provider credentials to this request. */
  ai?: boolean;
  /** Sentence shown if the response carries no message of its own. */
  failure: string;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/**
 * The user's provider key travels on the AI request that needs it and nowhere
 * else — it lives in their browser, and the server never stores it.
 */
function aiHeaders(): Record<string, string> {
  const credential = getDefaultCredential();
  if (!credential) return {};
  return {
    "X-AI-Provider": credential.provider,
    "X-AI-Model": credential.model,
    "X-AI-Api-Key": credential.apiKey,
  };
}

/** Throw a descriptive Error if a response isn't OK; otherwise return it. */
async function ensureOk(res: Response, message: string): Promise<Response> {
  if (res.ok) return res;

  const body = await res.text().catch(() => "");
  // The API reports every failure as {"error": "...", "detail": "..."};
  // surface that sentence rather than the raw JSON, which used to be shown to
  // users verbatim.
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error || parsed?.detail || body;
  } catch {
    // Not JSON — use the body as-is.
  }
  throw new Error(detail || `${message} (${res.status} ${res.statusText})`);
}

/** Issue one request, and throw a readable Error if it fails. */
async function request(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, form, query, ai, failure } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (ai) Object.assign(headers, aiHeaders());

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    // The session is an httpOnly cookie, so it has to be sent explicitly.
    credentials: "same-origin",
  });

  return ensureOk(res, failure);
}

/** A request whose body is JSON. */
async function json<T>(path: string, options: RequestOptions): Promise<T> {
  const res = await request(path, options);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** A request whose body is the model's raw text. */
async function text(path: string, options: RequestOptions): Promise<string> {
  return (await request(path, options)).text();
}

// ── Current user ──────────────────────────────────────────────────────────

/** The shape `/api/me` and both sign-in routes answer with. */
export interface SessionResponse {
  user: {
    id: string;
    email?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    picture?: string | null;
    username?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  } | null;
  isNewUser?: boolean;
}

async function getCurrentUser(): Promise<SessionResponse> {
  // An anonymous visitor is answered with 200 and a null user rather than a
  // failure, so this never throws for the expected first-visit case.
  return json<SessionResponse>("/me", { failure: "Failed to fetch current user" });
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
  return json("/profile", {
    method: "PATCH",
    body: update,
    failure: "Failed to update profile",
  });
}

// ── Sign in, sign up, sign out ────────────────────────────────────────────

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  given_name?: string;
  family_name?: string;
}

/** Create an account. The response is already signed in. */
export async function registerAccount(payload: Registration): Promise<SessionResponse> {
  return json<SessionResponse>("/auth/register", {
    method: "POST",
    body: payload,
    failure: "Could not create that account",
  });
}

export async function loginWithPassword(payload: Credentials): Promise<SessionResponse> {
  return json<SessionResponse>("/auth/login", {
    method: "POST",
    body: payload,
    failure: "Could not sign in",
  });
}

/** End this browser's session. The cookie is cleared by the response. */
export async function logoutSession(): Promise<void> {
  await request("/auth/logout", { method: "POST", failure: "Could not sign out" });
}

/** Change the signed-in user's password, signing every other browser out. */
export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await request("/auth/password", {
    method: "POST",
    body: payload,
    failure: "Could not change your password",
  });
}

/** Upload an image file (avatar, etc.) and return its public URL. */
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url } = await json<{ url: string }>("/files/upload", {
    method: "POST",
    form,
    failure: "Upload failed",
  });
  return url;
}

// ── AI ────────────────────────────────────────────────────────────────────

/**
 * POST to an AI route, with the user's provider credentials attached.
 *
 * Every AI call goes through here, so the body, the headers and the error
 * unwrapping exist once. They used to be spread across three idioms — the Hono
 * RPC client, a LaTeX-only helper, and bare `fetch` — which is how the same
 * failure reached the user with three different messages.
 */
function aiJson<T>(path: string, body: unknown, failure: string): Promise<T> {
  return json<T>(`/ai/${path}`, { method: "POST", body, ai: true, failure });
}

function aiText(path: string, body: unknown, failure: string): Promise<string> {
  return text(`/ai/${path}`, { method: "POST", body, ai: true, failure });
}

/** The envelope both hierarchy endpoints return: a ```json fence inside JSON. */
export type HierarchyEnvelope = { status: string; data?: { topics?: string } };

/** Ask for a topic hierarchy for a subject the writer names. */
export async function searchTopics(query: string) {
  return aiJson<HierarchyEnvelope>("search-topics", { query }, "Failed to search topics");
}

/** Derive an outline from a draft that already exists. */
export async function outlineFromDocument(document: string, format: DocFormat) {
  return aiJson<HierarchyEnvelope>(
    "outline-from-document",
    { document, format },
    "Failed to outline this document",
  );
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
  /**
   * The whole outline as a numbered tree, marked with what is already
   * written. "Do not repeat the other sections" is only followable if the
   * model can see which of them exist.
   */
  hierarchy?: string;
  /** Sub-sections written separately; a parent must not cover them. */
  children?: string[];
  /** Headings this section is nested inside, outermost first. */
  ancestors?: string[];
  /** Its number in the outline — "2.3" — so the model knows where it sits. */
  section_number?: string;
  /**
   * What the writer asked for beyond the title. `topic` says what the section
   * is about; this says how it should be written, and the prompt lets it
   * override the standing rules it contradicts.
   */
  instruction?: string;
  /** Heading depth, so the section opens at the right level. */
  level?: number;
}

/** Write one section of a document. Returns the model's raw markup. */
export async function requestSection(body: SectionBody): Promise<string> {
  return aiText("generate-section", body, "Failed to generate the section");
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
  return aiText("transform", req, "The AI edit failed");
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

/** One row of the outline sent for refinement, with what it already cost. */
export interface OutlineRowIn {
  title: string;
  level: number;
  /**
   * Words already written under it. A restructure that moves a section
   * carrying 900 words is a different proposition from moving an empty
   * heading, and the model cannot weigh that if it only sees titles.
   */
  words?: number;
}

/** Ask for a better-organised outline, and the reasoning behind each move. */
export async function refineOutline(
  outline: OutlineRowIn[],
  subject: string,
  instruction: string,
  format: DocFormat,
): Promise<RefinedOutline> {
  return aiJson<RefinedOutline>(
    "refine-outline",
    { outline, subject, instruction, format },
    "Could not refine the outline",
  );
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
  /** Positional against `coAuthors`; null where that person has no handle. */
  coAuthorUsernames?: (string | null)[];
  isPublic: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Create a new lesson plan, or update it in place when it already has an id. */
export async function saveLessonPlan(lessonPlan: LessonPlan) {
  return lessonPlan.id
    ? json<LessonPlanResponse>(`/lessonPlans/${lessonPlan.id}`, {
        method: "PUT",
        body: lessonPlan,
        failure: "Failed to save lesson plan",
      })
    : json<LessonPlanResponse>("/lessonPlans", {
        method: "POST",
        body: lessonPlan,
        failure: "Failed to save lesson plan",
      });
}

export async function getLessonPlans() {
  return json<{ lessonPlans: LessonPlanResponse[] }>("/lessonPlans", {
    failure: "Failed to get lesson plans",
  });
}

export async function deleteLessonPlan(id: number) {
  await request(`/lessonPlans/${id}`, {
    method: "DELETE",
    failure: "Failed to delete lesson plan",
  });
  return true;
}

export async function getPublicLessonPlans() {
  return json<{ lessonPlans: LessonPlanResponse[] }>("/lessonPlans/public", {
    failure: "Failed to get public lesson plans",
  });
}

/** What the viewer holding a document's link may do with it. */
export type DocumentAccess = "owner" | "co-author" | "reader";

export interface SharedDocument {
  plan: LessonPlanResponse;
  access: DocumentAccess;
}

/**
 * One document as its share link reaches it, whoever is holding the link.
 *
 * The single fetch behind `/projects/:format/:id`. It replaces the two-step
 * dance the reader used — ask for it as yours, and if that 404s ask for it as
 * published — which could not tell "not yours" from "not there", spent two
 * round trips proving a document was private, and left the caller guessing at
 * whether to open the editor or the reader. The server decides, once.
 *
 * Rejects rather than returning an error shape: the caller has three outcomes
 * to distinguish (edit, read, nothing), and folding "no access" into the same
 * union as the other two is what made the old call sites ambiguous.
 */
export async function fetchSharedDocument(id: number): Promise<SharedDocument> {
  return json<SharedDocument>(`/lessonPlans/${id}/shared`, {
    failure: "That document is not available",
  });
}

// ── Users ─────────────────────────────────────────────────────────────────

/** One row of the co-author picker's autocomplete. */
export interface UsernameMatch {
  id: string;
  username: string;
  givenName?: string | null;
}

/** Username autocomplete. Answers with an empty list rather than throwing:
 *  a failed lookup while typing should not surface as an error. */
export async function searchUsername(query: string): Promise<UsernameMatch[]> {
  try {
    const data = await json<{ users: UsernameMatch[] }>("/search/username", {
      query: { q: query },
      failure: "Failed to search users",
    });
    return data.users ?? [];
  } catch {
    return [];
  }
}

/** Only what an attribution line needs. */
export interface Byline {
  id: string;
  given_name?: string | null;
  family_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

async function getUserById(id: string): Promise<Byline | null> {
  try {
    const data = await json<{ user: Byline }>(`/user/${encodeURIComponent(id)}`, {
      failure: "Failed to fetch user",
    });
    return data.user ?? null;
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
  const data = await json<{ people: Person[] }>("/people", {
    query: { q: query },
    failure: "Failed to load people",
  });
  return data.people ?? [];
}

export async function fetchPersonProfile(
  username: string,
): Promise<{ person: Person; published: PublishedDoc[] }> {
  return json<{ person: Person; published: PublishedDoc[] }>(
    `/people/${encodeURIComponent(username)}`,
    { failure: "Profile not found" },
  );
}

/** Full display name, falling back to the handle. */
export function personName(p: Pick<Person, "givenName" | "familyName" | "username">): string {
  const full = [p.givenName, p.familyName].filter(Boolean).join(" ").trim();
  return full || p.username || "Member";
}
