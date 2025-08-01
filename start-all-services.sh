#!/bin/bash

echo "🚀 Starting All Services for Testing"
echo "===================================="

# Kill any existing Node processes
echo "Stopping any existing services..."
pkill -f "node" || true
pkill -f "tsx" || true

sleep 2

# Start resolver service on port 3001
echo "Starting Resolver Service (port 3001)..."
npm run resolver:dev &
RESOLVER_PID=$!

sleep 3

# Start proxy server on port 3002
echo "Starting Proxy Server (port 3002)..."
npm run proxy:dev &
PROXY_PID=$!

sleep 3

# Start frontend on port 3000
echo "Starting Frontend (port 3000)..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

sleep 3

echo ""
echo "✅ All services started!"
echo ""
echo "Services running:"
echo "- Frontend: http://localhost:3000"
echo "- Resolver API: http://localhost:3001"
echo "- Proxy Server: http://localhost:3002"
echo ""
echo "Test the app at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo -e "\nStopping all services..."
    kill $RESOLVER_PID $PROXY_PID $FRONTEND_PID 2>/dev/null
    pkill -f "node" || true
    pkill -f "tsx" || true
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Wait for user to press Ctrl+C
wait