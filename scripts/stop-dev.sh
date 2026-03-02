#!/bin/bash

# Navigate to the project root
cd "$(dirname "$0")/.."

PID_FILE="scripts/.dev_pids"

if [ -f "$PID_FILE" ]; then
    echo "Stopping background processes..."
    
    # Read PIDs
    NGROK_PID=$(sed -n '1p' "$PID_FILE")
    DEV_PID=$(sed -n '2p' "$PID_FILE")
    
    # Kill specific PIDs gently, then forcefully if needed
    kill $NGROK_PID 2>/dev/null
    kill $DEV_PID 2>/dev/null
    
    rm "$PID_FILE"
else
    echo "No .dev_pids file found."
fi

# Fallback to pkill to ensure any child processes (like Vite) are also caught
echo "Ensuring all related processes are killed..."
pkill -f "ngrok http 5173" 2>/dev/null
pkill -f "vite" 2>/dev/null
# In case `npm run dev` leaves node hanging
pkill -f "npm run dev" 2>/dev/null

echo "Processes stopped."
