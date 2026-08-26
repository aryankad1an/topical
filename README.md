# Topical

**You bring a topic. Topical brings the structure, the research, and the first draft.**

Topical is a web application for writing long, structured documents — the kind
with numbered sections, equations, figures and references. You give it a
subject; it proposes a hierarchy of sections; then it writes them one at a
time, on your instruction, grounded in live web sources rather than model
memory alone.

Nothing is written for you behind your back. Every section arrives as a draft
you read, place, and revise. The AI is a drafting tool inside an editor you
control — not a chat box that hands you a finished document.

It writes **MDX** (Markdown with maths) or **LaTeX**, side by side with a live
preview, and it is built for lesson plans, course notes, research summaries,
and technical documentation.

---

## Contents

- [What it does](#what-it-does)
- [How it fits together](#how-it-fits-together)
- [Running it locally](#running-it-locally)
- [Your first document](#your-first-document)
- [Working on the code](#working-on-the-code)
- [Deploying](#deploying)

---

## What it does

### Structure before prose

Generation starts from an outline, not a blank page. Ask for a subject and
Topical returns a tree of sections and subsections; the **outline rail** on the
right of the editor is where you reorder, nest, rename, add and delete them.

Because the outline exists first, each section prompt carries the *rest* of the
document with it — every sibling's title, its address (`2.3`), and whether it
has been written yet. That is what stops four sections from saying the same
thing. Three outline operations are available:

| Operation | What it's for |
|---|---|
| Propose an outline | Build a section hierarchy for a new subject |
| Outline from a document | Recover the structure a draft you already have is reaching for |
| Refine an outline | Restructure what's there, with a stated reason for each change |

### Grounded section drafting

For each section you choose where the material comes from:

- **Model** — the model's own knowledge, nothing fetched.
- **Web** — a live crawl for that section's topic, summarised into the prompt.
- **URLs** — up to four pages you name yourself.

You can attach an instruction to any generation ("keep it under 250 words",
"lead with a worked example", "include a comparison table"), or write your own.
The draft comes back as a snippet you place; it is never silently spliced into
your document.

### An editor that knows the format

- `/` opens a menu of every construct the current format has — headings, lists,
  tables, code blocks, figures, theorem environments, equations.
- Lists and environments continue on Enter; `Tab` and `⇧Tab` indent and outdent.
- `⌘B` / `⌘I` / `⌘E` / `⌘K` wrap the selection; `⌘1`–`⌘3` set heading level.
- `⌘F` is find-and-replace over the source; `⌘\` toggles the outline rail;
  `⌘/` lists every shortcut; `⌘K` opens a command palette for pages and actions.

Select a passage and press `⌘J` for AI on what *you* wrote: improve, expand,
shorten, fix grammar, simplify, set an academic tone, turn it into bullets or a
table, set the maths, continue from the caret, explain what it says and what it
misses — or give a free-form instruction. Nothing is applied until you have read
the result.

### A real preview

The preview pane is not a Markdown viewer with a LaTeX shim bolted on. The
LaTeX path is a parser → preamble → renderer pipeline that handles the
article-shaped subset people actually write: numbered sections, `\ref` and
`\cite` resolution, `\newcommand` macros, theorem environments, floats, tables,
footnotes and bibliographies, with KaTeX for maths and scroll sync against the
source. Unknown commands still render their argument, so text never silently
disappears, and anything it cannot handle is reported as an issue rather than
dropped.

### Collaboration, sharing and publishing

- **Real-time multiplayer** over the Yjs CRDT, with peer cursors. The server is
  a full participant — it holds the merged document — so joining a document
  that is already being edited shows you its current state, not an empty page.
- **Co-authors.** Invite another account to write with you.
- **One address per document.** `/projects/mdx/12201` names the document and
  nothing else; the *server* decides whether you get the editor, the reader, or
  a locked notice. A link is safe to hand to anyone.
- **Export and publish.** Download `.md` / `.tex`, print to PDF, or publish to a
  public library with a community forum (posts, comments, votes) attached.

### Your own model, your own account

- **Bring your own key.** Gemini, OpenAI, Anthropic, xAI or Mistral, routed
  through LiteLLM. Keys are per-user, held in your browser, and sent only as a
  header on the one request that needs them — never stored server-side, never
  logged.
- **In-house authentication.** Email and password, Argon2id hashes, revocable
  server-side sessions. No third-party identity provider to register with.
- Light and dark themes, resolved before first paint.

---

## How it fits together

One backend, one process. It serves the REST API under `/api`, the
collaboration socket at `/ws/doc/{id}`, all AI generation, and — in production —
the built frontend. In development Vite serves the app and proxies `/api` and
`/ws` to it.

```
                  ┌──────────────────────────────┐
browser ─ /api ──▶│  FastAPI (:3000)             │──▶ model provider (LiteLLM)
   │              │  api → services → db         │──▶ live web (Crawl4AI)
   └──── /ws ────▶│  realtime: Yjs rooms         │
                  └───────────────┬──────────────┘
                                  ▼
                             PostgreSQL
```

| Layer | Stack | Dev port |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, TanStack Router + Query, Tailwind, Yjs | `5173` |
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2 (async) over asyncpg, Alembic | `3000` |
| Data | PostgreSQL | — |
| AI | LiteLLM (provider routing), Crawl4AI (live web) | — |

Four tables carry everything: `users` (account and profile), `lesson_plans`
(a document — its sections as `jsonb`, its co-authors as a `jsonb` array of
user ids, and a public flag), `auth_sessions`, and the `community_posts` /
`community_post_comments` / `community_post_votes` trio.

> **A naming quirk to know up front.** The storage layer calls a document a
> *lesson plan* — that is the table name, the model name, and the API prefix
> (`/api/lessonPlans`). The table predates the editor. Everywhere a user can
> see it, it is a *document*.

---

## Running it locally

**Prerequisites**

- **Python 3.10 or newer.** Crawl4AI does not import on 3.9.
- **Node.js and npm.**
- **A reachable PostgreSQL database.** Local or hosted; anything that gives you
  a connection string.

**Setup**

```bash
git clone https://github.com/aryankad1an/topical.git
```

```bash
cd topical && cd frontend && npm install && cd ..
```

```bash
cp .env.example .env    # then set DATABASE_URL
```

```bash
./run.sh
```

`run.sh` frees ports 3000 and 5173, creates `.venv` and installs the Python
dependencies on first run (including the headless browser Crawl4AI needs),
applies migrations, and starts both processes. Open **http://localhost:5173**
and create an account.

If you want to pin a specific interpreter, create `.venv` yourself before the
first run — otherwise `run.sh` picks the first Python ≥ 3.10 it finds.

### Configuration

`DATABASE_URL` is the only variable you must set. Authentication is in-house,
so there is nothing to register with anywhere.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string, in ordinary `postgresql://` form |
| `HOST` / `PORT` | no | Where the backend listens. Default `0.0.0.0:3000` |
| `ENVIRONMENT` | no | `production` marks session cookies Secure, which needs HTTPS |
| `SESSION_TTL_DAYS` | no | How long a session survives unused. Default 14 |
| `UPLOADS_DIR` | no | Where uploaded images are written. Default `./uploads` |
| `LOG_LEVEL` | no | Default `INFO` |

Provider API keys are deliberately **not** environment variables — each user
adds their own in the UI.

### Add a provider key

Generation stays disabled until there is a key. Open **Profile → AI Providers**,
pick a provider and model, paste the key, and click **Add & verify key**. The
key is checked against the provider before it is saved, so a bad one fails
immediately instead of halfway through a generation.

---

## Your first document

1. **Start a document** and give it a topic. Topical proposes a section tree.
2. **Shape the outline** in the right-hand rail — reorder, nest, rename, add,
   or ask for a refinement pass. The rail is where structure and generation
   meet; everything else follows from what's in it.
3. **Write a section.** Pick its grounding (model, web crawl, or your own URLs),
   optionally attach an instruction, and place the draft where you want it.
4. **Edit.** `/` for constructs, `⌘J` for AI on a selection, `⌘F` to find and
   replace. The preview keeps up.
5. **Share.** Invite a co-author, export `.md` / `.tex`, print to PDF, or
   publish to the community library.

---

## Working on the code

```bash
source .venv/bin/activate
```

| Command | What it does |
|---|---|
| `python -m backend` | Backend only, with reload |
| `cd frontend && npm run dev` | Frontend only |
| `cd frontend && npx tsc --noEmit` | Typecheck |
| `cd frontend && npm run lint` | Lint (zero-warning policy) |
| `cd frontend && npm run build` | Production bundle |
| `alembic revision --autogenerate -m "…"` | Migration from model changes |
| `alembic upgrade head` / `alembic downgrade -1` | Apply / undo |

With the backend running, **http://localhost:3000/docs** is the full route list
with request and response schemas, and `/health` reports whether the database is
configured.

There is no automated test suite yet. If you are changing something with real
consequences — auth, the CRDT room lifecycle, the LaTeX renderer — expect to
verify it by hand, and adding tests alongside is welcome.

### Layout

```
backend/
  main.py                 app factory: middleware, routers, static — in assembly order
  api/routes/             HTTP only — one module per resource, gathered under /api
  services/               what the app does, framework-free
    ai/                   prompts, provider routing, crawling, generation
  db/models/              the tables
  auth/                   passwords, sessions, the current-user dependency
  realtime/yjs.py         collaboration rooms and the y-protocols wire format
  core/                   settings, errors, logging, validation
  cli.py                  administrative commands
alembic/versions/         migrations

frontend/src/
  features/editor/        the writing screen — components, hooks, and pure lib/
  features/preview/       rendering; latex/ is parser → preamble → renderer
  features/home/          the landing page and its live demo
  components/ui/          shared primitives
  routes/                 TanStack Router file routes
  lib/                    API client, auth context, types, document URLs
  styles/                 split by what the rules describe; index.css sets cascade order
```

### Conventions that hold it together

- **The backend's layers depend downward only.** A service never imports
  FastAPI; a route never writes SQL. That is what lets a service be called from
  a script, a worker or a test rather than only from inside a request.
- **Editor text operations are pure functions** over `(document, selection)` in
  `features/editor/lib/textOps.ts`. The toolbar, the shortcuts, the `/` menu and
  the AI panels all drive the same behaviour because they all call the same
  functions.
- **An outline in the rail is not the document's outline.** `PlanItem[]` is a
  flat list with an explicit level, representing structure that does *not* exist
  on the page yet. The document's actual outline is read from its headings
  (`sections.ts`).
- **One address per document.** `lib/documentUrl.ts` is the only place a
  document URL is built. The address names the document; the server's `access`
  verdict (`owner` / `co-author` / `reader`) decides what you may do with it.

### AI endpoints

All `POST` under `/api/ai/`, session required. Each reads the provider, model
and key from the `X-AI-Provider`, `X-AI-Model` and `X-AI-Api-Key` headers; the
key is used for that one call and never stored or logged.

| Endpoint | Purpose |
|---|---|
| `search-topics` | Build the section hierarchy for a subject |
| `outline-from-document` | The outline an existing draft is reaching for |
| `refine-outline` | Restructure an outline, with a reason for each change |
| `generate-section` | Write one section |
| `transform` | Rewrite, extend or explain a selected passage |

`generate-section` takes `format` (`mdx` | `latex`) and `source` (`llm`, `web`
or `urls`) rather than being six near-identical endpoints. Provider failures map
to real statuses — `401` rejected key, `429` rate limit, `404` unknown model,
`502` malformed response, `504` timeout — with messages that are safe to show a
user. Capacity errors, rate limits and timeouts are retried with backoff before
any of that.

### Administration

Things no signed-in user should be able to do:

```bash
python -m backend.cli list-users
```

```bash
python -m backend.cli set-password <email>
```

```bash
python -m backend.cli prune-sessions
```

`set-password` takes `--create` to make the account if it does not exist.

### Notes worth reading before you change things

- **Authentication.** Argon2id hashes carry their own cost parameters. Sessions
  are opaque 32-byte tokens stored only as SHA-256 in `auth_sessions` and
  delivered in an httpOnly, `SameSite=Lax` cookie — which is also the CSRF
  defence. Failed sign-ins are constant-shape and constant-time, so the login
  form is not a register of who holds an account. User ids are uuid4 hex, not
  serials, because they appear in URLs and in co-author arrays.
- **Collaboration state is in memory.** A Yjs room is discarded 30 seconds after
  its last connection leaves. The durable copy is saved through the REST API —
  `realtime/` is never the source of truth.
- **Grounding degrades rather than fails.** If Crawl4AI is not importable or its
  browser is missing, `services/ai/crawl.py` falls back to urllib +
  BeautifulSoup. Every blocking fetch is pushed to a worker thread; awaiting one
  inline would stall every concurrent request.
- **Interface material.** `styles/glass.css` loads late and re-skins surfaces the
  earlier files have already laid out, so it must win their background, border
  and shadow — `index.css` is the only place that order lives. The rule it
  enforces: glass goes on chrome that floats *over* content, never on a card
  sitting on flat page ground. Glass is never nested, every pane keeps a
  hairline, and `@supports` / `prefers-reduced-transparency` fall back to opaque
  surfaces with the same layout.
- **Latency.** The database is usually in a different region from the server, so
  three things are load-bearing: the pool is warmed at boot (`warm_pool`),
  `pool_pre_ping` is off in favour of `pool_recycle`, and `last_seen_at` is
  written at most hourly (`_TOUCH_INTERVAL` in `backend/auth/session.py`).
- **Connection strings.** `DATABASE_URL` is written in ordinary `postgresql://`
  form and translated for asyncpg in `backend/core/config.py`, which also drops
  libpq-only parameters like `sslmode`.

---

## Deploying

The `Dockerfile` builds the frontend into the Python image, so one container
serves everything. Migrations run at boot, and the baseline revision adopts an
existing schema rather than recreating it, so restarting is safe.

```bash
docker build -t topical .
```

```bash
docker run -p 3000:3000 -e DATABASE_URL=postgres://... -v topical_uploads:/app/uploads topical
```

`fly.toml` is configured for the same image; set the database as a secret with
`fly secrets set DATABASE_URL=…`. Two things to remember:

- **Uploaded images are on disk.** Mount a volume at `/app/uploads` or they
  vanish on deploy.
- **Collaboration rooms live in memory.** A second machine has its own rooms and
  a stopped machine loses whatever was open on it, which is why `fly.toml` keeps
  `min_machines_running = 1`.

---

## License

MIT
