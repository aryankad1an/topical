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

# Setup and start Python FastAPI service
echo "-> Setting up Python environment..."
if [ ! -d "rag/venv" ]; then
    python3 -m venv rag/venv
fi
source rag/venv/bin/activate
pip install -r rag/requirements.txt
echo "-> Starting FastAPI AI service..."
uvicorn rag.main:app --host 127.0.0.1 --port 8000 &
RAG_PID=$!

# Start frontend development server in the background
echo "-> Starting Vite frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Cleanup function to kill both background processes on exit
function cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID $RAG_PID 2>/dev/null || true
    exit
}

# Trap termination signals to run cleanup
trap cleanup SIGINT SIGTERM EXIT

# Wait for background processes
wait
