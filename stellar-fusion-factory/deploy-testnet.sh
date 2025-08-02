#!/bin/bash

# Deploy and test the factory on testnet first

# Check if WASM file exists
if [ ! -f "target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm" ]; then
    echo "❌ Factory WASM not found. Run ./build.sh first"
    exit 1
fi

# First, we need to deploy the HTLC contract to testnet to get its WASM hash
echo "🔧 Building and deploying HTLC contract to testnet first..."

# Build HTLC if needed
if [ ! -f "../stellar-fusion/target/wasm32-unknown-unknown/release/stellar_escrow.optimized.wasm" ]; then
    echo "Building HTLC contract..."
    cd ../stellar-fusion
    cargo build --target wasm32-unknown-unknown --release
    stellar contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_escrow.wasm
    cd ../stellar-fusion-factory
fi

# Deploy HTLC to testnet and get WASM hash
echo "📦 Deploying HTLC template to testnet..."
HTLC_DEPLOY=$(stellar contract deploy \
    --wasm ../stellar-fusion/target/wasm32-unknown-unknown/release/stellar_escrow.optimized.wasm \
    --source-account test \
    --network testnet 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ HTLC deployment failed:"
    echo "$HTLC_DEPLOY"
    exit 1
fi

HTLC_CONTRACT_ID=$(echo "$HTLC_DEPLOY" | tail -n 1)
echo "✅ HTLC template deployed at: $HTLC_CONTRACT_ID"

# Get the WASM hash
HTLC_WASM_HASH=$(shasum -a 256 ../stellar-fusion/target/wasm32-unknown-unknown/release/stellar_escrow.optimized.wasm | cut -d' ' -f1)
echo "📋 HTLC WASM Hash: $HTLC_WASM_HASH"

# Get test account from Stellar CLI
echo ""
echo "🔑 Getting test account..."
TEST_ACCOUNT=$(stellar keys address test)
echo "Test Account: $TEST_ACCOUNT"

# Deploy factory
echo ""
echo "🚀 Deploying Factory contract to testnet..."
FACTORY_DEPLOY=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm \
    --source-account test \
    --network testnet 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Factory deployment failed:"
    echo "$FACTORY_DEPLOY"
    exit 1
fi

FACTORY_ID=$(echo "$FACTORY_DEPLOY" | tail -n 1)
echo "✅ Factory deployed at: $FACTORY_ID"

# Initialize factory
echo ""
echo "🔧 Initializing factory..."
stellar contract invoke \
    --id "$FACTORY_ID" \
    --source-account test \
    --network testnet \
    -- initialize \
    --admin "$TEST_ACCOUNT" \
    --htlc_wasm_hash "$HTLC_WASM_HASH"

if [ $? -ne 0 ]; then
    echo "❌ Factory initialization failed"
    exit 1
fi

echo "✅ Factory initialized!"

# Test deployment of an escrow
echo ""
echo "🧪 Testing escrow deployment..."

# Generate test parameters
ORDER_HASH="0000000000000000000000000000000000000000000000000000000000000001"
HASHLOCK="0000000000000000000000000000000000000000000000000000000000000002"
AMOUNT="1000000000" # 100 XLM in stroops
SAFETY_DEPOSIT="100000000" # 10 XLM
TIMELOCKS="1234567890" # Example timelock value

echo "Deploying test escrow..."
ESCROW_ADDRESS=$(stellar contract invoke \
    --id "$FACTORY_ID" \
    --source-account test \
    --network testnet \
    -- deploy_escrow \
    --order_hash "$ORDER_HASH" \
    --hashlock "$HASHLOCK" \
    --maker "$TEST_ACCOUNT" \
    --taker "$TEST_ACCOUNT" \
    --token "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" \
    --amount "$AMOUNT" \
    --safety_deposit "$SAFETY_DEPOSIT" \
    --timelocks "$TIMELOCKS" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Escrow deployment failed:"
    echo "$ESCROW_ADDRESS"
    exit 1
fi

ESCROW_ID=$(echo "$ESCROW_ADDRESS" | tail -n 1 | tr -d '"')
echo "✅ Test escrow deployed at: $ESCROW_ID"

# Verify escrow state
echo ""
echo "🔍 Verifying escrow state..."
STATE=$(stellar contract invoke \
    --id "$ESCROW_ID" \
    --source-account test \
    --network testnet \
    -- get_state 2>&1)

echo "Escrow state: $STATE"

echo ""
echo "🎉 Testnet deployment successful!"
echo ""
echo "📝 Testnet Deployment Summary:"
echo "   Factory Contract: $FACTORY_ID"
echo "   HTLC Template: $HTLC_CONTRACT_ID"
echo "   Test Escrow: $ESCROW_ID"
echo "   HTLC WASM Hash: $HTLC_WASM_HASH"
echo ""
echo "💡 Use this WASM hash for mainnet deployment!"

# Save testnet deployment info
cat > testnet_deployment.json << EOF
{
  "factory_id": "$FACTORY_ID",
  "htlc_template_id": "$HTLC_CONTRACT_ID",
  "htlc_wasm_hash": "$HTLC_WASM_HASH",
  "test_escrow_id": "$ESCROW_ID",
  "admin": "$TEST_ACCOUNT"
}
EOF

echo "💾 Deployment info saved to testnet_deployment.json"