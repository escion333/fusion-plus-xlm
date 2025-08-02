#!/bin/bash

# Initialize the already deployed factory

echo "🔧 Initializing Stellar Factory"
echo "=============================="
echo ""

# Configuration
CONTRACT_ID="CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL"
HTLC_WASM_HASH="a2b1fe28fe6bcdad4bd7c2f5a0955f4b943ee0045f638b4bccf4e6eb638dc2a8"
ADMIN_ADDRESS="GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4"
SECRET_KEY="${STELLAR_TEST_WALLET_SECRET}"
SOROBAN_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

if [ -z "$SECRET_KEY" ]; then
    echo "❌ STELLAR_TEST_WALLET_SECRET not set"
    exit 1
fi

echo "📋 Factory Contract: $CONTRACT_ID"
echo "👤 Admin: $ADMIN_ADDRESS"
echo ""

# Initialize with higher fee
echo "Initializing factory contract..."
stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SECRET_KEY" \
    --rpc-url "$SOROBAN_RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --fee 10000000 \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --htlc_wasm_hash "$HTLC_WASM_HASH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Factory initialized successfully!"
    echo ""
    echo "🎉 Stellar Factory is ready!"
    echo "Contract ID: $CONTRACT_ID"
    echo ""
    echo "Next steps:"
    echo "1. Update .env: STELLAR_FACTORY_MAINNET=$CONTRACT_ID"
    echo "2. Deploy Base resolver"
    echo "3. Test cross-chain swaps"
else
    echo ""
    echo "❌ Initialization failed"
    echo "Check your XLM balance or try again with higher fee"
fi