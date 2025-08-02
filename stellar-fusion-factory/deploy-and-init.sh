#!/bin/bash

# Deploy and initialize the Stellar Escrow Factory contract

# Check if WASM file exists
if [ ! -f "target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm" ]; then
    echo "❌ Factory WASM not found. Run ./build.sh first"
    exit 1
fi

# Configuration
HTLC_WASM_HASH="a2b1fe28fe6bcdad4bd7c2f5a0955f4b943ee0045f638b4bccf4e6eb638dc2a8"
ADMIN_ADDRESS="GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"
SECRET_KEY="${STELLAR_SECRET_KEY:-${STELLAR_TEST_WALLET_SECRET}}"

if [ -z "$SECRET_KEY" ]; then
    echo "❌ STELLAR_SECRET_KEY or STELLAR_TEST_WALLET_SECRET environment variable not set"
    echo "Please set: export STELLAR_SECRET_KEY=your_secret_key"
    exit 1
fi

echo "🚀 Deploying Stellar Escrow Factory contract to mainnet..."
echo "📋 HTLC WASM Hash: $HTLC_WASM_HASH"
echo "👤 Admin Address: $ADMIN_ADDRESS"
echo ""

# Deploy the factory contract
echo "📦 Deploying contract..."
DEPLOY_OUTPUT=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm \
    --source "$SECRET_KEY" \
    --network mainnet 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# Extract contract ID from output
CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | tail -n 1)
echo "✅ Factory deployed at: $CONTRACT_ID"
echo ""

# Initialize the factory
echo "🔧 Initializing factory..."
INIT_OUTPUT=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SECRET_KEY" \
    --network mainnet \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --htlc_wasm_hash "$HTLC_WASM_HASH" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Initialization failed:"
    echo "$INIT_OUTPUT"
    exit 1
fi

echo "✅ Factory initialized successfully!"
echo ""
echo "📝 Factory Contract Details:"
echo "   Contract ID: $CONTRACT_ID"
echo "   Admin: $ADMIN_ADDRESS"
echo "   HTLC Template Hash: $HTLC_WASM_HASH"
echo ""
echo "🎉 Factory is ready to deploy HTLC escrows!"
echo ""
echo "💡 To deploy an escrow, use:"
echo "stellar contract invoke --id $CONTRACT_ID --network mainnet -- deploy_escrow ..."

# Save the contract ID to a file
echo "$CONTRACT_ID" > factory_contract_id.txt
echo "💾 Contract ID saved to factory_contract_id.txt"