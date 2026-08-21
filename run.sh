#!/bin/bash

# Exit on error
set -e

# ── Kill any processes already on our ports ──
echo "-> Freeing ports 3000, 8000, 5173..."
for PORT in 3000 8000 5173; do
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null) || true
    if [ -n "$PIDS" ]; then
        echo "   Killing PID(s) $PIDS on port $PORT"
        kill -9 $PIDS 2>/dev/null || true
    fi
done
sleep 0.5   # brief pause to let OS release the sockets

echo "Starting topical..."


echo "-> Starting Bun backend..."
bun run dev &
BACKEND_PID=$!

# Setup and start Python FastAPI service.
# crawl4ai requires Python >= 3.10, so pick a suitable interpreter.
echo "-> Setting up Python environment..."
if [ ! -d "ai_service/venv" ]; then
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
    echo "   Creating venv with $PYTHON ($($PYTHON --version))"
    "$PYTHON" -m venv ai_service/venv
    source ai_service/venv/bin/activate
    pip install -r ai_service/requirements.txt
    crawl4ai-setup   # download the headless browser crawl4ai uses
else
    source ai_service/venv/bin/activate
    pip install -r ai_service/requirements.txt
fi
echo "-> Starting FastAPI AI service..."
uvicorn ai_service.main:app --host 127.0.0.1 --port 8000 --reload &
AI_PID=$!

# Start frontend development server in the background
echo "-> Starting Vite frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Cleanup function to kill both background processes on exit
function cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID $AI_PID 2>/dev/null || true
    exit
}

# Trap termination signals to run cleanup
trap cleanup SIGINT SIGTERM EXIT

# Wait for background processes
wait
