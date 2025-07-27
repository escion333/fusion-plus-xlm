# Testnet Deployment Guide

This guide provides step-by-step instructions for deploying the Stellar Fusion+ protocol to testnets.

## Prerequisites

### Tools Required
- Stellar CLI (latest version)
- Node.js 18+ and npm
- Rust toolchain with wasm32-unknown-unknown target
- Git
- curl or httpie for API testing

### Accounts Needed
- Stellar testnet account with XLM (get from https://laboratory.stellar.org/#account-creator)
- Ethereum Sepolia testnet account with ETH (get from https://sepoliafaucet.com/)
- Alchemy or Infura API key for Ethereum RPC

## Step 1: Prepare Stellar Contract

### 1.1 Build the Contract

```bash
cd stellar-fusion

# Ensure you have the wasm target
rustup target add wasm32-unknown-unknown

# Build optimized WASM
cargo build --target wasm32-unknown-unknown --release

# Verify the build
ls -la target/wasm32-unknown-unknown/release/stellar_fusion.wasm
```

### 1.2 Generate Stellar Testnet Account

```bash
# Install Stellar CLI if not already installed
cargo install --locked stellar-cli

# Generate a new account
stellar keys generate --global testnet_deployer --network testnet

# Fund the account (visit the URL it provides)
stellar keys fund testnet_deployer --network testnet

# Verify the account is funded
stellar keys show testnet_deployer
```

## Step 2: Deploy to Stellar Testnet

### 2.1 Deploy the Contract

```bash
# Deploy the contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_fusion.wasm \
  --source testnet_deployer \
  --network testnet

# Save the contract ID (you'll see output like: Contract ID: CCREUWGQJMHVQWKXK4K6ZXZXK6KHZXZXK6ZXZXK6ZXZXK6)
export STELLAR_CONTRACT_ID="YOUR_CONTRACT_ID_HERE"

# Verify deployment
stellar contract invoke \
  --id $STELLAR_CONTRACT_ID \
  --source testnet_deployer \
  --network testnet \
  -- \
  version
```

### 2.2 Initialize Native Token Configuration

```bash
# Set native token address for testnet
stellar contract invoke \
  --id $STELLAR_CONTRACT_ID \
  --source testnet_deployer \
  --network testnet \
  -- \
  set_native_token \
  --token "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
```

## Step 3: Deploy Ethereum Contracts

### 3.1 Prepare Ethereum Environment

```bash
# Navigate to the cross-chain example
cd docs/external-docs/cross-chain-resolver-example

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
EOF
```

### 3.2 Deploy Resolver Contract

```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy-resolver.js --network sepolia

# Save the deployed addresses
export ETHEREUM_RESOLVER_ADDRESS="0x..."
export ETHEREUM_ESCROW_FACTORY="0x..."

# Verify on Etherscan (optional)
npx hardhat verify --network sepolia $ETHEREUM_RESOLVER_ADDRESS
```

## Step 4: Configure Resolver Service

### 4.1 Set Up Environment

```bash
cd src/services/resolver

# Create complete .env file
cat > .env << EOF
# Network Configuration
NODE_ENV=testnet

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_CONTRACT_ID=$STELLAR_CONTRACT_ID
STELLAR_RESOLVER_SECRET=$(stellar keys show testnet_deployer --secret)

# Ethereum Configuration
ETHEREUM_NETWORK=sepolia
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETHEREUM_RESOLVER_ADDRESS=$ETHEREUM_RESOLVER_ADDRESS
ETHEREUM_ESCROW_FACTORY=$ETHEREUM_ESCROW_FACTORY
ETHEREUM_RESOLVER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/fusion_testnet
REDIS_URL=redis://localhost:6379

# Service Configuration
PORT=3001
LOG_LEVEL=debug
ENABLE_MONITORING=true
EOF
```

### 4.2 Start Resolver Service

```bash
# Start dependencies
docker-compose -f ../../../docker-compose.resolver.yml up -d

# Run database migrations
npm run migrate

# Start the service
npm run dev

# Verify it's running
curl http://localhost:3001/health
```

## Step 5: Deploy Frontend

### 5.1 Configure Frontend

```bash
cd frontend

# Create production environment file
cat > .env.production << EOF
NEXT_PUBLIC_RESOLVER_API_URL=https://your-resolver-api.com
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_CONTRACT_ID=$STELLAR_CONTRACT_ID
NEXT_PUBLIC_ETHEREUM_NETWORK=sepolia
NEXT_PUBLIC_ETHEREUM_ESCROW_FACTORY=$ETHEREUM_ESCROW_FACTORY
NEXT_PUBLIC_ETHEREUM_CHAIN_ID=11155111
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
EOF

# Build for production
npm run build

# Test locally
npm run start
```

### 5.2 Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Go to: https://vercel.com/your-project/settings/environment-variables
```

## Step 6: Test the Deployment

### 6.1 Create Test Swap via API

```bash
# Create a test swap
curl -X POST http://localhost:3001/api/swaps \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": "ethereum",
    "destChain": "stellar",
    "sourceToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "destToken": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    "amount": "1000000",
    "maker": "0xYourEthereumAddress",
    "taker": "GYourStellarAddress"
  }'
```

### 6.2 Monitor Swap Progress

```bash
# Get swap status
curl http://localhost:3001/api/swaps/SWAP_ID

# Watch resolver logs
docker-compose -f docker-compose.resolver.yml logs -f resolver
```

### 6.3 Test via Frontend

1. Open your deployed frontend URL
2. Connect MetaMask (switch to Sepolia network)
3. Connect Freighter wallet
4. Create a small test swap
5. Monitor the progress in the UI

## Step 7: Verify Everything Works

### Checklist

- [ ] Stellar contract responds to queries
- [ ] Ethereum contracts are verified on Etherscan
- [ ] Resolver service health check passes
- [ ] Frontend loads without errors
- [ ] Wallets connect successfully
- [ ] Test swap completes end-to-end

### Common Issues and Solutions

1. **Stellar deployment fails**
   - Ensure account has enough XLM
   - Check network is set to testnet
   - Verify WASM file exists

2. **Ethereum deployment fails**
   - Check you have Sepolia ETH
   - Verify RPC URL is correct
   - Ensure private key has 0x prefix

3. **Resolver can't connect**
   - Check all environment variables
   - Verify database is running
   - Check network connectivity

4. **Frontend wallet issues**
   - Ensure correct network in wallet
   - Check chain IDs match
   - Verify contract addresses

## Monitoring and Logs

### View Logs

```bash
# Resolver logs
docker-compose logs -f resolver

# Stellar contract events
stellar events --id $STELLAR_CONTRACT_ID --network testnet

# Frontend logs (if using Vercel)
vercel logs
```

### Health Checks

```bash
# Resolver health
curl http://localhost:3001/health

# Stellar network status
curl https://horizon-testnet.stellar.org/

# Ethereum network status
curl https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Next Steps

1. Run comprehensive integration tests
2. Set up monitoring dashboards
3. Configure alerts for failures
4. Document any custom configurations
5. Prepare for mainnet deployment

## Security Notes

- Never commit private keys or secrets
- Use separate accounts for testnet
- Monitor for suspicious activity
- Keep testnet funds minimal
- Rotate API keys regularly