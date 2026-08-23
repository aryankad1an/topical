<div align="center">
  <h1>Topical</h1>
  <p><b>Where the human brain works with artificial intelligence.</b></p>
</div>

Topical turns a topic into a structured, publishable document. You give it a
subject; it generates a hierarchy of subtopics, then writes each section on
demand — grounded in live web sources rather than model memory alone. You keep
editorial control: every section arrives as a draft snippet you place, edit, and
arrange yourself.

Built for lesson plans, research summaries, and technical documentation.

---

## Features

- **MDX and LaTeX.** Write interactive MDX with embedded code, or LaTeX for
  academic and scientific work. Both render live in a split-pane preview with
  syntax highlighting, an outline rail, and line-accurate scroll sync.
- **A LaTeX preview that behaves like LaTeX.** Sections, equations, figures and
  tables are numbered; `\ref`/`\eqref`/`\cite` resolve; `\newcommand` macros
  expand; theorem environments, footnotes and bibliographies render. Anything
  unsupported is reported as an issue instead of vanishing.
- **Editing that knows the format.** `/` opens every construct the format has,
  lists and `\item`s continue on Enter, Tab indents a block, ⌘B/⌘I/⌘K wrap the
  selection, and find-and-replace works over the source.
- **Inline AI on the words you already wrote.** Select a passage and press ⌘J to
  improve, expand, shorten, simplify, fix grammar, set the maths, or run a custom
  instruction. Nothing is applied until you have read the result.
- **Hierarchy-first generation.** Topical plans before it writes: it produces a
  topic tree, then generates each section with the surrounding structure as
  context, so sections don't overlap or repeat each other. It can also outline a
  draft you already have.
- **Grounded in live sources.** Generation can draw on real-time web crawling
  (via Crawl4AI), specific URLs you supply, or the model's own knowledge —
  your choice per section.
- **Bring your own model.** Gemini, OpenAI, Anthropic, xAI, or Mistral. Keys are
  per-user and never leave your browser except as a request header.
- **Light and dark.** Follows the OS until you say otherwise; switching wipes
  across the page from the button you pressed.
- **Export.** Download the source as `.md`/`.tex` (LaTeX comes wrapped in a
  compilable document), copy it, or print the rendered document to PDF.
- **Real-time collaboration.** CRDT-backed multiplayer editing (Yjs) with live
  peer cursors and presence.
- **Publish and browse.** Share documents to a public library, or keep them
  private. Community forum included.

---

## Architecture

Three services, decoupled:

| Service | Stack | Port |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, TanStack Router, Tailwind, Yjs | `5173` |
| Backend API + WebSockets | Bun, Hono, PostgreSQL, Drizzle ORM | `3000` |
| AI content service | Python 3.10+, FastAPI, LiteLLM, Crawl4AI | `8000` |

The frontend talks only to the backend. The backend proxies `/api/ai/*` to the
Python service, forwarding the caller's provider credentials as headers. LiteLLM
handles provider routing, so adding a model is a config change rather than a
new integration.

```
browser ──▶ Hono API (:3000) ──▶ FastAPI AI service (:8000) ──▶ provider
   │              │                        │
   │              ▼                        ▼
   └── WS ──▶ Yjs sync            Crawl4AI (live web)
                  │
                  ▼
             PostgreSQL
```

---

## Getting started

### Prerequisites

- **Python 3.10+** — required by Crawl4AI, which fails to import on 3.9.
- **Bun** — runs the backend.
- **Node.js + npm** — runs the Vite frontend.
- **PostgreSQL** — a reachable database.

### 1. Install

```bash
git clone https://github.com/aryankad1an/topical.git
cd topical

bun install                    # backend
cd frontend && npm install     # frontend
cd ..
```

The Python virtualenv is created automatically on first run — see step 4.

### 2. Configure

```bash
cp .env.example .env
```

**`DATABASE_URL` is the only required variable.**

Kinde auth variables are optional. When they are unset, the server injects a
mock `dev@localhost` user, so you can run the whole app locally without auth
credentials. Set them only when you want real login:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `AI_SERVICE_URL` | no | Defaults to the local FastAPI service |
| `KINDE_*` | no | Real authentication; omit for a mock dev user |

If you do configure Kinde, add `http://localhost:5173/api/callback` as an
Allowed Callback URL and `http://localhost:5173` as an Allowed Logout Redirect
URL.

> API keys for AI providers are **not** environment variables — they are
> configured per user in the web UI. See step 5.

### 3. Migrate the database

```bash
bun run db:migrate
```

### 4. Run

```bash
./run.sh
```

This frees ports 3000/8000/5173, starts all three services, and on first run
creates `ai_service/venv`, installs Python dependencies, and downloads the
headless browser Crawl4AI needs. Open **http://localhost:5173**.

### 5. Add an AI provider key

Generation is disabled until you add a key. Keys live in browser storage and are
sent only as request headers.

1. Open **Profile → AI Providers**.
2. Choose a provider and model.
3. Paste your API key and click **Add & verify key**.

The key is verified against the provider before being saved, so a bad key fails
immediately rather than at generation time.

---

## Development

```bash
bun run dev                  # backend only, with watch
cd frontend && npm run dev   # frontend only
bun run db:generate          # generate a migration from schema changes
npx tsc --noEmit             # typecheck (run at the root, and inside frontend/)
cd frontend && npm run lint  # lint
```

### Layout

```
frontend/src/
  features/editor/        the writing screen
    components/           header, toolbar, code surface, outline rail, AI panels
    hooks/                document + collaboration, editing, find, scroll sync,
                          outline rows, section writing, drag-to-resize
    lib/                  pure text operations, highlighting, outline, export
  features/preview/       rendering, shared by editor / reader / community
    latex/                parser → preamble → renderer pipeline
  components/ui/          shared primitives (Surface, Avatar, Chip, IconButton…)
  styles/                 the stylesheet, split by what the rules describe;
                          index.css lists them in cascade order
ai_service/
  main.py                 routes only
  models.py               request bodies
  prompts.py              every prompt, including the inline-edit actions
  providers.py            credentials, completion, error translation
  crawl.py                web crawling
```

Text operations in `features/editor/lib/textOps.ts` are pure functions over
`(document, selection)`, which is what lets the toolbar, the keyboard shortcuts,
the `/` menu and the AI panels all drive the same behaviour.

### Toolchain notes

- **Drizzle is pinned** to `drizzle-orm` 0.29.5 with `drizzle-kit` 0.20.18.
  Request bodies are validated with plain `zod`, so nothing depends on
  `drizzle-zod`'s old refinement API any more — but the config is still
  0.20-style (`driver: "pg"`, `generate:pg`), so upgrade the pair together.
- `run.sh` picks the first Python ≥ 3.10 it finds. To pin one, create
  `ai_service/venv` yourself before the first run.

### AI service endpoints

All are `POST`, mounted under `/ai/`, and proxied through `/api/ai/*`. Each
reads the provider, model, and key from the `X-AI-Provider`, `X-AI-Model`, and
`X-AI-Api-Key` headers.

| Endpoint | Purpose |
|---|---|
| `search-topics` | Build the topic hierarchy for a subject |
| `outline-from-document` | The outline an existing draft is reaching for |
| `refine-outline` | Restructure an outline, with a reason for each change |
| `generate-section` | Write one section of a document |
| `transform` | Rewrite, extend or explain one selected passage |

`generate-section` takes `format` (`mdx` \| `latex`) and `source` (`llm` for
the model's own knowledge, `web` for a live crawl of the topic, `urls` for
pages you name). It replaced six endpoints that differed only in those two
fields — which is why the LaTeX crawl used to skip a fallback the MDX one had.

Provider failures map to real HTTP statuses — `401` for a rejected key, `429`
for rate limits, `404` for an unknown model, `504` on timeout — each with a
message safe to show a user. Raw provider payloads are logged, never returned.

---

## License

MIT
