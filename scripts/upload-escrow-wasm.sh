#!/bin/bash

echo "📦 Uploading Escrow WASM to Stellar Network"
echo "========================================="
echo ""

# Configuration
ESCROW_WASM="stellar-fusion/target/wasm32-unknown-unknown/release/stellar_escrow.optimized.wasm"
SECRET_KEY="${STELLAR_TEST_WALLET_SECRET}"
SOROBAN_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Check prerequisites
if [ ! -f "$ESCROW_WASM" ]; then
    echo "❌ Escrow WASM not found: $ESCROW_WASM"
    echo "Building it now..."
    cd stellar-fusion && ./build.sh && cd ..
fi

if [ -z "$SECRET_KEY" ]; then
    echo "❌ STELLAR_TEST_WALLET_SECRET not set"
    exit 1
fi

# Get account public key
PUBLIC_KEY=$(stellar keys address "$SECRET_KEY" 2>/dev/null)
echo "🔑 Uploading from: $PUBLIC_KEY"
echo ""

# Upload WASM and get hash
echo "📤 Uploading escrow WASM..."
WASM_HASH=$(stellar contract install \
    --wasm "$ESCROW_WASM" \
    --source "$SECRET_KEY" \
    --rpc-url "$SOROBAN_RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --fee 10000000 \
    2>&1 | tail -n 1)

if [ $? -eq 0 ] && [ -n "$WASM_HASH" ]; then
    echo "✅ WASM uploaded successfully!"
    echo "📋 WASM Hash: $WASM_HASH"
    echo ""
    echo "Now initializing factory with this WASM hash..."
    
    # Initialize factory with the uploaded WASM hash
    CONTRACT_ID="CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL"
    ADMIN_ADDRESS="GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"
    
    echo "🔧 Initializing factory contract..."
    stellar contract invoke \
        --id "$CONTRACT_ID" \
        --source "$SECRET_KEY" \
        --rpc-url "$SOROBAN_RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --fee 10000000 \
        -- initialize \
        --admin "$ADMIN_ADDRESS" \
        --htlc_wasm_hash "$WASM_HASH"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Factory initialized with escrow WASM!"
        echo "🎉 Ready for cross-chain swaps!"
    else
        echo "❌ Factory initialization failed"
        echo "The factory might already be initialized"
    fi
else
    echo "❌ WASM upload failed"
    echo "Output: $WASM_HASH"
fi