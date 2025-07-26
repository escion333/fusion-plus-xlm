#!/bin/bash

echo "🚀 Starting 1inch API Proxy Server..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Please run setup first:"
    echo "   ./scripts/1inch/run-fork.sh"
    exit 1
fi

# Build TypeScript files
echo "📦 Building TypeScript files..."
npm run build

# Start the proxy server
echo "🌐 Starting proxy server..."
node dist/proxy/server.js