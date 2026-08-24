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
  peer cursors and presence. The server holds the merged document, so opening a
  file someone else is already editing shows you their work immediately.
- **Accounts you own.** Email and password, Argon2id hashes, and server-side
  sessions you can revoke. No third-party identity provider.
- **Publish and browse.** Share documents to a public library, or keep them
  private. Community forum included.

---

## Architecture

One backend, one process:

| Part | Stack | Port |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, TanStack Router, Tailwind, Yjs | `5173` (dev) |
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL | `3000` |

The backend serves the REST API, the collaboration WebSocket, AI generation,
and — in production — the built frontend. In development Vite serves the app
and proxies `/api` and `/ws` to it. LiteLLM handles provider routing, so adding
a model is a config change rather than a new integration.

```
                 ┌─────────────────────────────┐
browser ── /api ─▶│  FastAPI (:3000)            │──▶ provider (via LiteLLM)
   │             │  api → services → db        │──▶ Crawl4AI (live web)
   └──── /ws ───▶│  realtime: Yjs rooms        │
                 └──────────────┬──────────────┘
                                ▼
                           PostgreSQL
```

The backend's layers depend downward only — a service never imports FastAPI, a
route never writes SQL:

```
backend/
  api/        HTTP: routing, status codes, request and response bodies
  services/   what the application does, given a session and a user
  db/         tables, and the session that reaches them
  auth/       accounts, passwords, and sessions
  realtime/   the collaborative-editing socket
  core/       settings, errors, logging, shared validation
```

---

## Getting started

### Prerequisites

- **Python 3.10+** — required by Crawl4AI, which fails to import on 3.9.
- **Node.js + npm** — runs the Vite frontend.
- **PostgreSQL** — a reachable database.

### 1. Install

```bash
git clone https://github.com/aryankad1an/topical.git
cd topical

cd frontend && npm install && cd ..
```

The Python virtualenv (`.venv`) is created automatically on first run — see
step 4.

### 2. Configure

```bash
cp .env.example .env
```

**`DATABASE_URL` is the only required variable.** Authentication is in-house,
so there is nothing to register with and no provider credentials to obtain.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `PORT` / `HOST` | no | Where the backend listens. Default `0.0.0.0:3000` |
| `ENVIRONMENT` | no | `production` marks session cookies Secure (needs HTTPS) |
| `SESSION_TTL_DAYS` | no | Session lifetime without use. Default 14 |
| `UPLOADS_DIR` | no | Where uploaded images are written. Default `./uploads` |

> API keys for AI providers are **not** environment variables — they are
> configured per user in the web UI. See step 5.

### 3. Migrate the database

```bash
source .venv/bin/activate
alembic upgrade head
```

`run.sh` does this for you on every start. The baseline revision adopts an
existing schema rather than recreating it, so it is safe to run against a
database that already holds data.

### 4. Run

```bash
./run.sh
```

This frees ports 3000/5173, applies migrations, and starts both processes. On
first run it creates `.venv`, installs the Python dependencies, and downloads
the headless browser Crawl4AI needs. Open **http://localhost:5173** and create
an account.

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
source .venv/bin/activate

python -m backend                       # backend only, with reload
cd frontend && npm run dev              # frontend only

alembic revision --autogenerate -m "…"  # a migration from model changes
alembic upgrade head                    # apply migrations
alembic downgrade -1                    # undo the last one

cd frontend && npx tsc --noEmit         # typecheck
cd frontend && npm run lint             # lint
```

The API documents itself: with the backend running, **http://localhost:3000/docs**
is the full route list with request and response schemas.

### Administration

Operations no signed-in user should be able to perform:

```bash
python -m backend.cli list-users              # who exists, and who can sign in
python -m backend.cli set-password <email>    # set or reset a password
python -m backend.cli set-password <email> --create
python -m backend.cli prune-sessions          # delete expired sessions
```

`set-password` is the way back in for an account that predates in-house
authentication: it keeps its profile and documents but has no password until
one is set.

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
backend/
  main.py                 the app factory: middleware, routers, static
  api/routes/             one module per resource; HTTP only
  services/               the application's behaviour, framework-free
    ai/                   prompts, providers, crawling, generation
  db/models/              the tables
  auth/                   passwords, sessions, the current-user dependency
  realtime/yjs.py         collaboration rooms and the y-protocols wire format
  core/                   settings, errors, logging, validation
  cli.py                  administrative commands
alembic/versions/         migrations
```

Text operations in `features/editor/lib/textOps.ts` are pure functions over
`(document, selection)`, which is what lets the toolbar, the keyboard shortcuts,
the `/` menu and the AI panels all drive the same behaviour.

### Authentication

Accounts live in this application's own database.

- **Passwords** are hashed with Argon2id (`argon2-cffi` defaults). The hash
  carries its own cost parameters, so raising them later upgrades each password
  silently at its owner's next sign-in.
- **Sessions** are opaque 32-byte random tokens in an httpOnly, SameSite=Lax
  cookie. Only the token's SHA-256 is stored, in `auth_sessions` — a leaked
  database yields no usable sessions. Signing out deletes the row, so it takes
  effect on the next request rather than whenever a token would have expired.
- **SameSite=Lax** is also the CSRF defence: the browser withholds the cookie on
  cross-site POSTs, which is every forged write this API has.
- A failed sign-in reports one sentence for both halves of the failure, and an
  unknown email costs the same time as a known one — so the login form is not a
  register of who holds an account.

### Toolchain notes

- `run.sh` picks the first Python ≥ 3.10 it finds. To pin one, create `.venv`
  yourself before the first run.
- **SQLAlchemy 2.0 async** throughout, over `asyncpg`. `DATABASE_URL` is written
  in the usual `postgresql://` form and translated for the driver in
  `backend/core/config.py`, which also drops libpq-only parameters like
  `sslmode` that asyncpg rejects outright.

### AI endpoints

All are `POST` under `/api/ai/`, and require a session. Each reads the provider,
model, and key from the `X-AI-Provider`, `X-AI-Model`, and `X-AI-Api-Key`
headers; the key is used for that one call and never stored or logged.

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

## Deploying

The `Dockerfile` builds the frontend and copies it into the Python image, so one
container serves everything. Migrations run at boot.

```bash
docker build -t topical .
docker run -p 3000:3000 -e DATABASE_URL=postgres://... -v topical_uploads:/app/uploads topical
```

`fly.toml` is configured for the same image. Two things to keep in mind:

- **Uploaded images are on disk.** Mount a volume at `/app/uploads`, or they
  vanish on deploy.
- **Collaboration rooms live in memory.** A second machine has its own rooms, so
  two people editing the same document must reach the same one. `fly.toml`
  keeps `min_machines_running = 1` for this reason.

---

## License

MIT
