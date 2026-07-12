<div align="center">
  <h1>Topical</h1>
  <p><b>Where the human brain works with artificial intelligence.</b></p>
  
  <!-- Badges -->
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Backend-Bun%20%7C%20Hono-fbf0df?style=flat-square&logo=bun&logoColor=black" alt="Bun" />
  <img src="https://img.shields.io/badge/AI_Service-Python%20%7C%20FastAPI-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="MIT License" />
</div>

<br />

Topical is a premium, AI-powered platform for creating beautifully structured documents. Whether you are building lesson plans, writing research papers, or documenting technical architecture, Topical brings together the power of an intelligent AI author and real-time collaboration so you can create, refine, and publish your knowledge seamlessly.

## ✨ Key Features

- **Rich Format Support (MDX & LaTeX):** Write interactive MDX documents with embedded code and components, or craft professional LaTeX documents optimized for academia, engineering, and science.
- **Context-Aware AI Generation:** Instead of generating blindly, Topical is strategic. It first generates a comprehensive content hierarchy, allowing you to generate each section one by one with full contextual awareness of the surrounding document structure.
- **Advanced Intelligence Sources:** The AI doesn't just rely on its internal training. It is powered by the **Google Gemini API** and aggressively augments its knowledge by crawling the **live Internet** and specific **user-provided URLs**, ensuring factual, up-to-date content.
- **Real-Time Multiplayer Collaboration:** Work together flawlessly. Topical features robust real-time collaboration with dynamic peer cursors, presence awareness, and CRDT-based state synchronization, allowing multiple authors to edit the exact same document simultaneously without conflicts.
- **One-Click Publishing:** Ready to share your work? Publish your projects to the public Topical library with a single click so the world can read and learn from your work.
- **Community Library & Forum:** Browse, explore, and learn from published lesson plans, research summaries, and technical docs created by other members of the Topical community.

---

## 🏗 Architecture

Topical is built on a modern, decoupled microservice architecture:

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, TanStack Router, Yjs |
| **Backend API & WebSockets** | Bun, Hono, PostgreSQL, Drizzle ORM |
| **AI Microservice** | Python 3.9+, FastAPI, `google-genai`, Crawl4AI |

---

## 🚀 Getting Started

### Prerequisites
Before you begin, ensure you have the following installed:
- [Python 3.9+](https://python.org/)
- [Bun](https://bun.sh/)
- [Node.js & npm](https://nodejs.org/) (for the Vite frontend)
- A running PostgreSQL database

### 1. Installation

Clone the repository and install the required dependencies for both the backend and the frontend:

```bash
git clone https://github.com/aryankad1an/topical.git
cd topical

# Install backend dependencies
bun install

# Install frontend dependencies
cd frontend && npm install
cd ..
```

### 2. Environment Configuration

Copy the example environment file to configure your local setup:
```bash
cp .env.example .env
```
Open `.env` and fill in your connection details:
- **Database:** Your local PostgreSQL connection string
- **Auth:** Your Kinde Auth credentials (`KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, etc.)

*Note: For local authentication to work, ensure your Kinde application settings have `http://localhost:5173/api/callback` as an Allowed Callback URL and `http://localhost:5173` as an Allowed Logout Redirect URL.*

### 3. Database Migration

Initialize your PostgreSQL database schema:
```bash
bun run db:migrate
```

### 4. Running the Platform Locally

We provide an orchestration script to start all necessary services concurrently. It will automatically set up the Python virtual environment for the AI service if it doesn't exist.

```bash
chmod +x run.sh
./run.sh
```

**Services Started:**
- 🟢 **Backend API & WebSockets:** `http://localhost:3000`
- 🟢 **AI Content Service:** `http://localhost:8000`
- 🟢 **Frontend UI:** `http://localhost:5173`

### 5. Configuring Your API Key

To enable the AI generation features in Topical, you must provide your Google Gemini API Key. 

**Important:** Instead of placing your API key in the `.env` file, **Topical handles API keys securely per-user within the web interface.**
1. Log in to your locally running Topical instance (`http://localhost:5173`).
2. Navigate to your **Profile** page.
3. Scroll down to the **AI Settings** section.
4. Enter and save your Gemini API Key. The platform will automatically verify it and enable the AI Generation workspace.

---

## 📜 License
MIT License
