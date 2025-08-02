#!/bin/bash

# Direct deployment script with explicit RPC configuration

echo "🚀 Deploying Stellar Escrow Factory to Mainnet"
echo "============================================"
echo ""

# Configuration
WASM_FILE="target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm"
HTLC_WASM_HASH="a2b1fe28fe6bcdad4bd7c2f5a0955f4b943ee0045f638b4bccf4e6eb638dc2a8"
ADMIN_ADDRESS="GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"
SECRET_KEY="${STELLAR_TEST_WALLET_SECRET}"
SOROBAN_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Check prerequisites
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ WASM file not found: $WASM_FILE"
    echo "Run ./build.sh first"
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo "❌ STELLAR_TEST_WALLET_SECRET not set"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "- WASM: $WASM_FILE"
echo "- Admin: $ADMIN_ADDRESS"
echo "- Network: Stellar Mainnet"
echo "- RPC: $SOROBAN_RPC_URL"
echo ""

# Get account public key
PUBLIC_KEY=$(stellar keys address "$SECRET_KEY" 2>/dev/null)
echo "🔑 Deploying from: $PUBLIC_KEY"
echo ""

# Deploy contract
echo "📦 Deploying contract..."
DEPLOY_OUTPUT=$(stellar contract deploy \
    --wasm "$WASM_FILE" \
    --source "$SECRET_KEY" \
    --rpc-url "$SOROBAN_RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --fee 10000000 \
    2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed:"
    echo "$DEPLOY_OUTPUT"
    
    # Check common issues
    if echo "$DEPLOY_OUTPUT" | grep -q "insufficient balance"; then
        echo ""
        echo "💡 Insufficient XLM balance. Need ~10 XLM for deployment."
        echo "   Fund account: $PUBLIC_KEY"
    fi
    exit 1
fi

# Extract contract ID
CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | grep -E "^C[A-Z0-9]{55}$" | tail -n 1)
if [ -z "$CONTRACT_ID" ]; then
    CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | tail -n 1)
fi

echo "✅ Factory deployed at: $CONTRACT_ID"
echo ""

# Initialize the factory
echo "🔧 Initializing factory..."
INIT_OUTPUT=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SECRET_KEY" \
    --rpc-url "$SOROBAN_RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --fee 1000000 \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --htlc_wasm_hash "$HTLC_WASM_HASH" \
    2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Initialization failed:"
    echo "$INIT_OUTPUT"
    exit 1
fi

echo "✅ Factory initialized successfully!"
echo ""

# Save deployment info
cat > mainnet_deployment.json << EOF
{
  "network": "mainnet",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "factory_contract_id": "$CONTRACT_ID",
  "admin": "$ADMIN_ADDRESS",
  "htlc_wasm_hash": "$HTLC_WASM_HASH",
  "deployer": "$PUBLIC_KEY"
}
EOF

echo "📝 Deployment Summary:"
echo "===================="
echo "Factory Contract: $CONTRACT_ID"
echo "Admin: $ADMIN_ADDRESS"
echo "HTLC Template: $HTLC_WASM_HASH"
echo ""
echo "💾 Deployment info saved to mainnet_deployment.json"
echo ""
echo "🎉 Factory is ready to deploy HTLC escrows!"
echo ""
echo "Next steps:"
echo "1. Update .env with STELLAR_FACTORY_MAINNET=$CONTRACT_ID"
echo "2. Deploy Base resolver contract"
echo "3. Test cross-chain swaps"