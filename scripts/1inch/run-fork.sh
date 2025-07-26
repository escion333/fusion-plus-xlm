#!/bin/bash

echo "🚀 Starting Hardhat mainnet fork..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating one with default values..."
    cat > .env << EOF
# Ethereum RPC URL (replace with your own for better performance)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/demo

# Sepolia RPC URL (for testnet deployment)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/demo

# Private key for deployments (DO NOT USE WITH REAL FUNDS)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 1inch API Key (optional - get from https://portal.1inch.dev)
ONEINCH_API_KEY=

# Stellar testnet
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
EOF
    echo "✅ Created .env file with default values"
    echo ""
fi

# Run the setup script
echo "📦 Running fork setup..."
npx hardhat run scripts/1inch/setup-fork.ts --network hardhat

# Keep the node running
echo ""
echo "✅ Fork is ready! Keeping node alive..."
echo "📡 RPC URL: http://localhost:8545"
echo ""
echo "Press Ctrl+C to stop the fork"

# Start the Hardhat node
npx hardhat node