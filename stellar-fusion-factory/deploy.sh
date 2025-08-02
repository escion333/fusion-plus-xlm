#!/bin/bash

# Deploy the Stellar Escrow Factory contract to mainnet

# Check if WASM file exists
if [ ! -f "target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm" ]; then
    echo "❌ Factory WASM not found. Run ./build.sh first"
    exit 1
fi

# HTLC contract WASM hash from the existing deployment
# This is the hash of the existing HTLC contract that will be used as the template
HTLC_WASM_HASH="a2b1fe28fe6bcdad4bd7c2f5a0955f4b943ee0045f638b4bccf4e6eb638dc2a8"

# Admin address (change this to your admin address)
# Using the deployer address as admin for now
ADMIN_ADDRESS="GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"

echo "🚀 Deploying Stellar Escrow Factory contract to mainnet..."
echo "📋 HTLC WASM Hash: $HTLC_WASM_HASH"
echo "👤 Admin Address: $ADMIN_ADDRESS"

# Deploy the factory contract
stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm \
    --network mainnet

echo "✅ Factory contract deployed!"
echo "⚠️  Remember to initialize the factory with the HTLC WASM hash"
echo "Run: stellar contract invoke --id <FACTORY_CONTRACT_ID> --network mainnet -- initialize --admin $ADMIN_ADDRESS --htlc_wasm_hash $HTLC_WASM_HASH"