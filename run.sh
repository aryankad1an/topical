#!/bin/bash
# Start Topical in development: the FastAPI backend on :3000, and Vite on
# :5173 proxying /api and /ws to it.
#
# There is one backend now. The Bun/Hono server and the separate AI service on
# :8000 were merged into it, so the proxy hop between them is gone along with
# the port.

set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

VENV="$REPO/.venv"

# ── Free the ports we are about to bind ──
echo "-> Freeing ports 3000, 5173..."
for PORT in 3000 5173; do
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null) || true
    if [ -n "$PIDS" ]; then
        echo "   Killing PID(s) $PIDS on port $PORT"
        kill -9 $PIDS 2>/dev/null || true
    fi
done
sleep 0.5   # let the OS release the sockets

# ── Python environment ──
# crawl4ai needs Python >= 3.10, so pick a suitable interpreter.
if [ ! -d "$VENV" ]; then
    PYTHON=""
    for cand in python3.13 python3.12 python3.11 python3.10 python3; do
        if command -v "$cand" >/dev/null 2>&1; then
            ver=$("$cand" -c 'import sys; print(sys.version_info.major*100 + sys.version_info.minor)')
            if [ "$ver" -ge 310 ]; then PYTHON="$cand"; break; fi
        fi
    done
    if [ -z "$PYTHON" ]; then
        echo "ERROR: Python 3.10+ is required (crawl4ai). Install it, e.g. 'brew install python@3.12'." >&2
        exit 1
    fi
    echo "-> Creating venv with $PYTHON ($($PYTHON --version))"
    "$PYTHON" -m venv "$VENV"
    source "$VENV/bin/activate"
    pip install --quiet --upgrade pip
    pip install -r requirements.txt
    crawl4ai-setup   # download the headless browser crawl4ai uses
else
    source "$VENV/bin/activate"
    pip install --quiet -r requirements.txt
fi

# ── Schema ──
# Idempotent: the baseline revision adopts an existing database rather than
# recreating it, so this is safe to run on every start.
echo "-> Applying database migrations..."
alembic upgrade head || echo "   (skipped — is DATABASE_URL set?)"

# ── Backend ──
echo "-> Starting FastAPI backend on :3000..."
python -m backend &
BACKEND_PID=$!

# ── Frontend ──
echo "-> Starting Vite frontend on :5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}
trap cleanup SIGINT SIGTERM EXIT

wait
