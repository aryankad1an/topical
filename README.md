<div align="center">
  <h1>Topical</h1>
  <p><b>Turn a topic into a structured, publishable document.</b></p>
</div>

Give Topical a subject. It plans a hierarchy of subtopics, then writes each
section on demand — grounded in live web sources rather than model memory
alone. You stay the editor: every section arrives as a draft you place, revise,
and rearrange yourself.

Built for lesson plans, research summaries, and technical documentation.

---

## Features

- **MDX or LaTeX**, side by side with a live preview — numbered sections and
  equations, resolving `\ref`/`\cite`, `\newcommand` macros, theorems,
  bibliographies, syntax highlighting, and scroll sync.
- **Hierarchy-first generation.** Topical outlines before it writes, so
  sections don't repeat each other. It can also outline a draft you already
  have, or restructure an outline and tell you why.
- **Grounded drafting.** Per section, choose the model's own knowledge, a live
  web crawl, or specific URLs you name.
- **Inline AI on what you wrote.** Select a passage, press `⌘J`, and improve,
  expand, shorten, simplify, fix grammar, set the maths, or give your own
  instruction. Nothing applies until you've read it.
- **Format-aware editing.** `/` opens every construct the format has, lists
  continue on Enter, Tab indents, `⌘B`/`⌘I`/`⌘K` wrap the selection, plus
  find-and-replace over the source.
- **Real-time collaboration.** CRDT multiplayer (Yjs) with peer cursors; the
  server holds the merged document, so joining shows you the current state.
- **Bring your own model.** Gemini, OpenAI, Anthropic, xAI, or Mistral. Keys
  are per-user, kept in your browser, and sent only as a request header.
- **Own your accounts.** Email and password, Argon2id hashes, revocable
  server-side sessions. No third-party identity provider.
- **Export and publish.** Download `.md`/`.tex`, print to PDF, or share to a
  public library with a community forum.

---

## Tech stack

| Layer | Stack | Dev port |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, TanStack Router + Query, Tailwind, Yjs | `5173` |
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2 (async) over asyncpg, Alembic | `3000` |
| Data | PostgreSQL | — |
| AI | LiteLLM (provider routing), Crawl4AI (live web) | — |

One backend, one process. It serves the REST API under `/api`, the
collaboration socket at `/ws/doc/{id}`, AI generation, and — in production —
the built frontend. In development Vite serves the app and proxies `/api` and
`/ws` to it.

```
                 ┌─────────────────────────────┐
browser ── /api ─▶│  FastAPI (:3000)            │──▶ model provider (LiteLLM)
   │             │  api → services → db        │──▶ Crawl4AI (live web)
   └──── /ws ───▶│  realtime: Yjs rooms        │
                 └──────────────┬──────────────┘
                                ▼
                           PostgreSQL
```

---

## Getting started

**Prerequisites:** Python 3.10+ (Crawl4AI won't import on 3.9), Node.js + npm,
and a reachable PostgreSQL database.

```bash
git clone https://github.com/aryankad1an/topical.git
cd topical
cd frontend && npm install && cd ..
cp .env.example .env        # then set DATABASE_URL
./run.sh
```

`run.sh` frees ports 3000/5173, creates `.venv` and installs Python
dependencies on first run (including the headless browser Crawl4AI needs),
applies migrations, and starts both processes. Open
**http://localhost:5173** and create an account.

### Configuration

`DATABASE_URL` is the only required variable — authentication is in-house, so
there is nothing to register with.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `HOST` / `PORT` | no | Where the backend listens. Default `0.0.0.0:3000` |
| `ENVIRONMENT` | no | `production` marks session cookies Secure (needs HTTPS) |
| `SESSION_TTL_DAYS` | no | Session lifetime without use. Default 14 |
| `UPLOADS_DIR` | no | Where uploaded images go. Default `./uploads` |
| `LOG_LEVEL` | no | Default `INFO` |

Provider API keys are **not** environment variables — each user adds their own
in the UI.

### Add an AI provider key

Generation stays disabled until you add one. Open **Profile → AI Providers**,
pick a provider and model, paste the key, and click **Add & verify key**. The
key is checked against the provider before it is saved, so a bad key fails
immediately rather than mid-generation.

---

## Using it

1. **Start a document.** Give it a topic; Topical proposes a subtopic tree.
2. **Shape the outline** in the rail on the right — reorder, nest, add, or ask
   for a refinement pass. The rail is where structure and generation meet.
3. **Generate a section.** Pick its grounding (model knowledge, a live crawl,
   or your own URLs); the draft arrives as a snippet you place where you want.
4. **Edit.** `/` for constructs, `⌘J` for AI on a selection, `⌘F` to find and
   replace. The preview keeps up.
5. **Share.** Export `.md`/`.tex`, print to PDF, or publish to the library.

---

## Development

```bash
source .venv/bin/activate

python -m backend                       # backend only, with reload
cd frontend && npm run dev              # frontend only

alembic revision --autogenerate -m "…"  # migration from model changes
alembic upgrade head                    # apply
alembic downgrade -1                    # undo the last one

cd frontend && npx tsc --noEmit         # typecheck
cd frontend && npm run lint             # lint
cd frontend && npm run build            # production bundle
```

With the backend running, **http://localhost:3000/docs** is the full route
list with request and response schemas.

### Layout

```
backend/
  main.py                 app factory: middleware, routers, static
  api/routes/             HTTP only — one module per resource, gathered under /api
  services/               what the app does, framework-free
    ai/                   prompts, providers, crawling, generation
  db/models/              the tables
  auth/                   passwords, sessions, the current-user dependency
  realtime/yjs.py         collaboration rooms and the y-protocols wire format
  core/                   settings, errors, logging, validation
  cli.py                  administrative commands
alembic/versions/         migrations

frontend/src/
  features/editor/        the writing screen (components, hooks, pure lib/)
  features/preview/       rendering; latex/ is a parser → preamble → renderer pipeline
  components/ui/          shared primitives
  routes/                 TanStack Router file routes
  styles/                 split by what the rules describe; index.css sets cascade order
```

Two conventions hold the codebase together:

- **The backend's layers depend downward only.** A service never imports
  FastAPI; a route never writes SQL.
- **Editor text operations are pure functions** over `(document, selection)`
  in `features/editor/lib/textOps.ts`. That is what lets the toolbar, the
  shortcuts, the `/` menu and the AI panels all drive the same behaviour.

### Administration

Things no signed-in user should be able to do:

```bash
python -m backend.cli list-users              # who exists, and who can sign in
python -m backend.cli set-password <email>    # set or reset a password
python -m backend.cli set-password <email> --create
python -m backend.cli prune-sessions          # delete expired sessions
```

### AI endpoints

All `POST` under `/api/ai/`, session required. Each reads the provider, model
and key from the `X-AI-Provider`, `X-AI-Model` and `X-AI-Api-Key` headers; the
key is used for that one call and never stored or logged.

| Endpoint | Purpose |
|---|---|
| `search-topics` | Build the topic hierarchy for a subject |
| `outline-from-document` | The outline an existing draft is reaching for |
| `refine-outline` | Restructure an outline, with a reason for each change |
| `generate-section` | Write one section |
| `transform` | Rewrite, extend or explain a selected passage |

`generate-section` takes `format` (`mdx` | `latex`) and `source` (`llm`,
`web`, or `urls`) rather than being six near-identical endpoints. Provider
failures map to real statuses — `401` rejected key, `429` rate limit, `404`
unknown model, `504` timeout — with messages safe to show a user.

### Notes worth knowing before you change things

- **Authentication.** Argon2id hashes carrying their own cost parameters;
  sessions are opaque 32-byte tokens stored only as SHA-256 in `auth_sessions`
  and delivered in an httpOnly, `SameSite=Lax` cookie — which is also the CSRF
  defence. Failed sign-ins are constant-shape and constant-time, so the login
  form isn't a register of who holds an account.
- **Interface material.** `styles/glass.css` loads last and re-skins surfaces
  the earlier files laid out, so it must win their background, border and
  shadow. The rule it enforces: glass goes on chrome that floats *over*
  content, never on a card sitting on flat page ground. Glass is never nested,
  every pane keeps a hairline, and `@supports` / `prefers-reduced-transparency`
  fall back to opaque surfaces with the same layout.
- **Latency.** The database is usually in a different region from the server,
  so three things are load-bearing: the pool is warmed at boot (`warm_pool`),
  `pool_pre_ping` is off in favour of `pool_recycle`, and `last_seen_at` is
  written at most hourly (`_TOUCH_INTERVAL` in `backend/auth/session.py`).
- **Toolchain.** `run.sh` picks the first Python ≥ 3.10 it finds; create
  `.venv` yourself first to pin one. `DATABASE_URL` is written in ordinary
  `postgresql://` form and translated for asyncpg in `backend/core/config.py`,
  which also drops libpq-only parameters like `sslmode`.

---

## Deploying

The `Dockerfile` builds the frontend into the Python image, so one container
serves everything. Migrations run at boot.

```bash
docker build -t topical .
docker run -p 3000:3000 -e DATABASE_URL=postgres://... -v topical_uploads:/app/uploads topical
```

`fly.toml` is configured for the same image. Two things to remember:

- **Uploaded images are on disk** — mount a volume at `/app/uploads` or they
  vanish on deploy.
- **Collaboration rooms live in memory** — a second machine has its own rooms,
  so `fly.toml` keeps `min_machines_running = 1`.

---

## License

MIT
