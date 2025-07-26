#!/bin/bash

echo "🚀 1inch Fusion+ Cross-Chain Demo"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if all services are running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -o /dev/null -w "%{http_code}" "$url/health" | grep -q "200\|404"; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $name is not running${NC}"
        return 1
    fi
}

echo "Checking services..."
echo ""

# Check each service
SERVICES_OK=true

if ! check_service "http://localhost:3000" "Frontend"; then
    SERVICES_OK=false
fi

if ! check_service "http://localhost:3001" "Resolver API"; then
    SERVICES_OK=false
fi

if ! check_service "http://localhost:3002" "1inch Proxy"; then
    SERVICES_OK=false
fi

if ! check_service "http://localhost:8545" "Hardhat Fork"; then
    SERVICES_OK=false
fi

echo ""

# If services aren't running, provide instructions
if [ "$SERVICES_OK" = false ]; then
    echo -e "${YELLOW}Some services are not running. Please start them first:${NC}"
    echo ""
    echo "1. Start Hardhat fork:"
    echo "   npm run fork"
    echo ""
    echo "2. Start 1inch proxy (new terminal):"
    echo "   npm run proxy:dev"
    echo ""
    echo "3. Start resolver (new terminal):"
    echo "   npm run resolver:dev"
    echo ""
    echo "4. Start frontend (new terminal):"
    echo "   npm run dev"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo -e "${GREEN}All services are running!${NC}"
echo ""

# Run the demo scenario
echo -e "${BLUE}Starting cross-chain demo scenario...${NC}"
echo ""

# First, ensure TypeScript is compiled
echo "Building TypeScript files..."
npm run build

# Run the demo
echo ""
echo "Running demo scenario..."
echo ""
npx hardhat run scripts/1inch/demo-scenario.ts --network localhost

echo ""
echo -e "${GREEN}Demo completed!${NC}"
echo ""
echo "📺 You can now:"
echo "1. View the frontend at http://localhost:3000"
echo "2. Check active orders in the UI"
echo "3. Monitor resolver logs"
echo "4. Create your own cross-chain swaps"
echo ""
echo "🎥 Ready to record demo video!"