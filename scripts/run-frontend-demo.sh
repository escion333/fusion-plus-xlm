#!/bin/bash

echo "🚀 Starting Fusion+ Frontend Demo"
echo "================================"
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.." || exit 1

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Enable mock mode
echo "🎭 Enabling mock mode for demo..."
if [ -f "frontend/.env.local" ]; then
    # Remove existing NEXT_PUBLIC_MOCK_MODE line if it exists
    sed -i '' '/NEXT_PUBLIC_MOCK_MODE=/d' "frontend/.env.local" 2>/dev/null || sed -i '/NEXT_PUBLIC_MOCK_MODE=/d' "frontend/.env.local"
    # Add mock mode
    echo "NEXT_PUBLIC_MOCK_MODE=true" >> "frontend/.env.local"
else
    # Create .env.local with mock mode
    cat > "frontend/.env.local" << EOF
NEXT_PUBLIC_RESOLVER_API_URL=http://localhost:3003
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_MOCK_MODE=true
EOF
fi

echo "✅ Mock mode enabled"
echo ""

# Start the frontend
echo "🌐 Starting frontend server..."
echo "   Access the demo at: http://localhost:3000"
echo ""
echo "📝 Demo Instructions:"
echo "   1. The demo uses simulated data - no real transactions"
echo "   2. Mock balances are provided automatically"
echo "   3. Wallet connections are optional in mock mode"
echo "   4. Watch the swap progress simulation"
echo ""
echo "🛑 To stop the demo, press Ctrl+C"
echo ""

cd frontend && npm run dev