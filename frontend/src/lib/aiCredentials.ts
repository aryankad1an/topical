/**
 * Client-side store for AI provider API keys. Keys never leave the browser
 * except as request headers sent straight to our AI service — matches the
 * previous single-Gemini-key design, just generalized to a list of
 * provider/model/key entries the user can choose between.
 */

export type AiProvider = "gemini" | "openai" | "anthropic" | "xai" | "mistral";

export interface AiCredential {
  id: string;
  provider: AiProvider;
  label: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
}

export interface ProviderPreset {
  provider: AiProvider;
  name: string;
  models: string[];
  keyPlaceholder: string;
  getKeyUrl: string;
  /** Brand hue, so each saved credential is identifiable at a glance. */
  color: string;
}

// Curated presets — kept short since model names move fast. Each provider's
// picker also offers a free-text "Custom model…" entry as an escape hatch.
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: "gemini",
    name: "Gemini",
    // Ordered newest-first so the top entry is the recommended default. The
    // tail matters: Gemini returns 503 "high demand" on the newest Flash often
    // enough that a one-click drop to an older, less-contended model is the
    // difference between waiting it out and getting work done.
    models: [
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
    keyPlaceholder: "AIza...",
    getKeyUrl: "https://aistudio.google.com/apikey",
      color: "#4285F4",
  },
  {
    provider: "openai",
    name: "OpenAI",
    models: ["gpt-5.2-chat-latest", "gpt-5.2-mini"],
    keyPlaceholder: "sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
      color: "#10A37F",
  },
  {
    provider: "anthropic",
    name: "Anthropic",
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    keyPlaceholder: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
      color: "#D97757",
  },
  {
    provider: "xai",
    name: "xAI",
    models: ["grok-4.6"],
    keyPlaceholder: "xai-...",
    getKeyUrl: "https://console.x.ai",
      color: "#C7CBD1",
  },
  {
    provider: "mistral",
    name: "Mistral",
    models: ["mistral-large-3"],
    keyPlaceholder: "...",
    getKeyUrl: "https://console.mistral.ai/api-keys",
      color: "#FA520F",
  },
];

const STORAGE_KEY = "topical_ai_credentials";
const LEGACY_GEMINI_KEY = "gemini_api_key";

/**
 * Every access is guarded.
 *
 * `localStorage` is not merely unreliable here, it can *throw* — private
 * windows and "block all cookies" make even a read raise. An unguarded read
 * on this path took the whole app down before any of it rendered, since the
 * API client reads credentials on the way to every request.
 */
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode and full quotas are not worth failing a request over.
  }
}

function readRaw(): AiCredential[] {
  const raw = readStored(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Anything but a list means the entry is corrupt; a non-array would
      // reach `.find`/`.filter` below and throw on every later call.
      if (Array.isArray(parsed)) return parsed as AiCredential[];
    } catch {
      // Unparseable — fall through and start clean.
    }
  }

  // Auto-migrate a pre-existing single Gemini key so nobody loses it.
  const legacy = readStored(LEGACY_GEMINI_KEY);
  if (legacy) {
    const migrated: AiCredential[] = [
      {
        id: crypto.randomUUID(),
        provider: "gemini",
        label: "Gemini",
        apiKey: legacy,
        model: "gemini-3.7-flash",
        isDefault: true,
      },
    ];
    writeStored(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  return [];
}

export function getCredentials(): AiCredential[] {
  return readRaw();
}

function write(creds: AiCredential[]) {
  writeStored(STORAGE_KEY, JSON.stringify(creds));
}

export function saveCredential(cred: Omit<AiCredential, "id"> & { id?: string }): AiCredential[] {
  const creds = readRaw();
  const id = cred.id || crypto.randomUUID();
  const next = creds.filter((c) => c.id !== id);
  const entry: AiCredential = { ...cred, id };

  // First saved key becomes the default automatically.
  if (next.length === 0) entry.isDefault = true;
  if (entry.isDefault) next.forEach((c) => (c.isDefault = false));

  next.push(entry);
  write(next);
  return next;
}

export function deleteCredential(id: string): AiCredential[] {
  const creds = readRaw().filter((c) => c.id !== id);
  // If the default got deleted, promote the first remaining entry.
  if (creds.length && !creds.some((c) => c.isDefault)) creds[0].isDefault = true;
  write(creds);
  return creds;
}

export function setDefaultCredential(id: string): AiCredential[] {
  const creds = readRaw().map((c) => ({ ...c, isDefault: c.id === id }));
  write(creds);
  return creds;
}

export function getDefaultCredential(): AiCredential | null {
  const creds = readRaw();
  return creds.find((c) => c.isDefault) || creds[0] || null;
}

export function presetFor(provider: AiProvider): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.provider === provider) || PROVIDER_PRESETS[0];
}
