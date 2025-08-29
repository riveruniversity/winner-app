#!/bin/bash

# Kill Development Servers Script
# This script stops all running development server instances

echo "🛑 Stopping all development servers..."

# First check if port 3001 is being used by Docker
if ps aux | grep -q "docker-proxy.*3001"; then
    echo "⚠️  WARNING: Port 3001 is being used by a Docker container!"
    echo "  This is likely the production backend server."
    echo "  To stop it, you need to stop the Docker container."
    echo ""
    echo "  Check running containers with: docker ps | grep 3001"
    echo "  Or ask the container owner (dustin) to stop it."
    echo ""
    echo "  For development, you can:"
    echo "  1. Change the backend port in .env (PORT=3002)"
    echo "  2. Or stop the Docker container if you have permission"
    echo ""
fi

# Kill Vite dev server
if pgrep -f "vite --host" > /dev/null; then
    echo "  Stopping Vite dev server..."
    pkill -f "vite --host"
fi

# Kill nodemon instances
if pgrep -f "nodemon backend/server.ts" > /dev/null; then
    echo "  Stopping nodemon server..."
    pkill -f "nodemon backend/server.ts"
fi

# Kill any npm run dev processes
if pgrep -f "npm run dev" > /dev/null; then
    echo "  Stopping npm run dev..."
    pkill -f "npm run dev"
fi

# Kill any npm run dev:server processes
if pgrep -f "npm run dev:server" > /dev/null; then
    echo "  Stopping npm run dev:server..."
    pkill -f "npm run dev:server"
fi

# Kill esbuild service (used by Vite)
if pgrep -f "esbuild --service" > /dev/null; then
    echo "  Stopping esbuild service..."
    pkill -f "esbuild --service"
fi

# Kill any direct node backend/server.js processes (but only for current user)
if pgrep -u $USER -f "node backend/server.js" > /dev/null; then
    echo "  Stopping node backend server..."
    pkill -u $USER -f "node backend/server.js"
fi

# Wait a moment for processes to terminate
sleep 1

# Check if any processes are still running
echo ""
echo "Checking for remaining processes..."
remaining=$(pgrep -f "vite|nodemon|npm run dev" | wc -l)

if [ $remaining -eq 0 ]; then
    echo "✅ All development servers stopped successfully!"
else
    echo "⚠️  Some processes may still be running. Use 'ps aux | grep -E \"vite|nodemon|npm\"' to check."
    echo "You may need to use 'kill -9' for stubborn processes."
fi

echo ""
echo "To restart the servers, run:"
echo "  npm run dev        (frontend only)"
echo "  npm run dev:server (backend only)"
echo "  npm run dev:all    (both frontend and backend)"