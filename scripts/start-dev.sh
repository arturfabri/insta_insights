#!/bin/bash

# Navigate to the project root
cd "$(dirname "$0")/.."

echo "Starting ngrok and dev server..."

# Start ngrok in the background
ngrok http 5173 > ngrok.log 2>&1 &
NGROK_PID=$!

# Start Vite dev server in the background
npm run dev > dev.log 2>&1 &
DEV_PID=$!

# Save PIDs
echo $NGROK_PID > scripts/.dev_pids
echo $DEV_PID >> scripts/.dev_pids

echo "Processes started!"
echo "- ngrok PID: $NGROK_PID (Logs: ngrok.log)"
echo "- dev PID: $DEV_PID (Logs: dev.log)"
echo "Use 'scripts/stop-dev.sh' to stop them."
