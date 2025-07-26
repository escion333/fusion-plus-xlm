#!/bin/bash

echo "🚀 Starting Stellar Fusion+ Local Environment"
echo "============================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Add your Ethereum RPC URL here
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Add your private keys here (DO NOT COMMIT!)
STELLAR_RESOLVER_SECRET=
ETHEREUM_RESOLVER_PRIVATE_KEY=
EOF
    echo "⚠️  Please edit .env file and add your API keys and private keys"
    echo "   Then run this script again."
    exit 1
fi

# Check if required env vars are set
source .env
if [ -z "$ETHEREUM_RPC_URL" ] || [ "$ETHEREUM_RPC_URL" == "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY" ]; then
    echo "❌ Please set ETHEREUM_RPC_URL in .env file"
    exit 1
fi

echo "🐳 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service status..."

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U fusion > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Check Resolver
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Resolver service is ready"
else
    echo "⏳ Resolver service is starting..."
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is ready"
else
    echo "⏳ Frontend is starting..."
fi

echo ""
echo "🎉 Stellar Fusion+ is starting up!"
echo ""
echo "📱 Frontend:         http://localhost:3000"
echo "🔧 Resolver API:     http://localhost:3001"
echo "🗄️  PostgreSQL:      localhost:5432"
echo "💾 Redis:           localhost:6379"
echo ""
echo "📋 View logs:        docker-compose logs -f"
echo "🛑 Stop services:    docker-compose down"
echo ""
echo "Happy swapping! 🚀"