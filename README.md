# Topical

Topical is an educational platform that helps users create, manage, and study structured lesson plans. It uses large language models and web crawling to generate learning materials from source content and provides a collaborative environment for educators and students.

### Architecture & Features

- **AI Content Microservice (FastAPI & Python)**: Integrated Google Gemini LLM and crawl4ai for context-aware crawling, generation, relevance scoring, and prompt optimization, providing high-quality educational content with subsecond inference.
- **Data & Auth Backend (Bun & Drizzle ORM)**: Built bun microservices for OAuth2 via Kinde Auth, secure file storage, and user management; used Drizzle ORM with PostgreSQL.
- **MDX Authoring UI (React & TypeScript)**: Created a React/TS front end with TanStack Router/Query, featuring a live MDX editor with JSX previews, drag-and-drop media, and component hydration.

---

## Prerequisites

- [Python 3.10+](https://python.org/)
- [Bun](https://bun.sh/)
- PostgreSQL database

---

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aryankad1an/topical.git
   cd topical
   ```

2. **Install dependencies:**
   ```bash
   bun install
   cd frontend && bun install
   ```

3. **Environment Setup:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your PostgreSQL connection string, Kinde credentials, and Google Gemini API key.

4. **Initialize Database:**
   ```bash
   bun run db:migrate
   ```

---

## Running Locally

Start all three services simultaneously:

```bash
chmod +x run.sh
./run.sh
```

This starts:
- **AI Content Service (FastAPI):** `http://localhost:8000`
- **Backend API (Bun/Hono):** `http://localhost:3000`
- **Frontend (Vite):** `http://localhost:5173`

*Note: For authentication to work locally, ensure your Kinde application settings have `http://localhost:5173/api/callback` as an Allowed Callback URL and `http://localhost:5173` as an Allowed Logout Redirect URL.*

## License
MIT License
