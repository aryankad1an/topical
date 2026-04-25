#!/bin/bash

# Exit on error
set -e

echo "Starting topical..."

# Start backend server in the background
echo "-> Starting backend..."
bun run dev &
BACKEND_PID=$!

# Start frontend development server in the background
echo "-> Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Cleanup function to kill both background processes on exit
function cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

# Trap termination signals to run cleanup
trap cleanup SIGINT SIGTERM EXIT

# Wait for background processes
wait
