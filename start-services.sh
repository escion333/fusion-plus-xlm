#!/bin/bash

echo "Starting all services for Fusion+ demo..."

# Kill any existing processes on the required ports
echo "Cleaning up old processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

# Start services in background
echo "Starting Extended Resolver on port 3003..."
npm run extended-resolver:dev &
RESOLVER_PID=$!

echo "Starting API Proxy on port 3002..."
npm run proxy:dev &
PROXY_PID=$!

echo "Starting Frontend on port 3000..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "Services started:"
echo "  - Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo "  - API Proxy: http://localhost:3002 (PID: $PROXY_PID)"
echo "  - Extended Resolver: http://localhost:3003 (PID: $RESOLVER_PID)"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt signal
trap "echo 'Stopping services...'; kill $FRONTEND_PID $PROXY_PID $RESOLVER_PID 2>/dev/null; exit" INT
wait