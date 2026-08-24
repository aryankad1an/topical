# syntax = docker/dockerfile:1

# One image, one process: the FastAPI backend serves the API, the
# collaboration socket, and the built frontend.

# ── Stage 1: build the frontend ──
FROM node:22-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: the runtime ──
# 3.12 rather than 3.13: crawl4ai's wheel set is complete there.
FROM python:3.12-slim

LABEL fly_launch_runtime="Python"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    PORT=3000

WORKDIR /app

# Build tools for the packages without a manylinux wheel (argon2-cffi's cffi,
# asyncpg on some platforms). Removed again in the same layer.
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y build-essential && apt-get autoremove -y

# crawl4ai's headless browser. Only the web-grounded generation mode needs it;
# without it that mode falls back to a plain HTTP fetch.
RUN crawl4ai-setup || echo "crawl4ai browser setup skipped; falling back to plain fetch"

COPY backend/ ./backend/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Uploaded images. Mount a volume here to keep them across deploys.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3000

# Migrations run at boot: the baseline revision adopts an existing schema
# rather than recreating it, so this is safe on every restart.
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
