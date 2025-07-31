# Stellar Fusion+ Integration Guide

⚠️ **CRITICAL UPDATE**: This guide is being revised. The resolver must be implemented as smart contracts that fill orders through the Limit Order Protocol, not just as a monitoring service. See `docs/ai-plans/resolver-contract-specification.md` for the correct architecture.

## Correct Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │  1inch Limit     │     │                 │
│  Frontend (UI)  │────▶│  Order Protocol  │────▶│ Resolver Smart  │
│                 │     │                  │     │   Contracts     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        │                        │                         │
        ▼                        ▼                         ▼
   User Controls          Order Broadcast           Atomic Escrow
   Secret Generation      & Dutch Auction            Deployment

                    Optional Monitoring Service
                    (Watches orders, triggers contracts)
```

## Key Architecture Changes

1. **Resolver = Smart Contracts** (not just service)
2. **Users control secrets** (not resolver)
3. **Orders filled via LOP** (not event monitoring)
4. **Atomic operations** (order fill + escrow deploy)

## Prerequisites

- Node.js 18+ and npm/yarn
- Rust and Stellar CLI installed
- Docker and Docker Compose
- MetaMask browser extension
- Freighter wallet browser extension
- Access to Ethereum testnet (Sepolia) and Stellar testnet
- 1inch API key (get from Developer Portal during hackathon)

## Component Setup

### 1. Stellar Contract Deployment

```bash
cd stellar-fusion

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Deploy to Stellar testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_fusion.wasm \
  --source YOUR_SECRET_KEY \
  --network testnet

# Note the contract ID returned
export STELLAR_CONTRACT_ID="CONTRACT_ID_HERE"
```

### 2. Resolver Smart Contract Deployment (NEW REQUIREMENT)

First, deploy the resolver contracts on both chains:

#### Ethereum Resolver Contract
```bash
# Deploy resolver contract
cd contracts/ethereum
npx hardhat run scripts/deploy-resolver.ts --network sepolia

# Note the resolver contract address
export ETH_RESOLVER_ADDRESS="0x..."
```

#### Stellar Resolver Contract
```bash
# Build and deploy Stellar resolver
cd stellar-fusion/resolver
cargo build --target wasm32-unknown-unknown --release

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/resolver.wasm \
  --source YOUR_SECRET_KEY \
  --network testnet

# Note the resolver contract ID
export STELLAR_RESOLVER_ID="C..."
```

### 3. Optional Monitoring Service Setup

The monitoring service is now optional and only watches for profitable orders:

```bash
cd src/services/resolver

# Update .env for new architecture
cat > .env << EOF
# Contract Addresses (not generating secrets!)
ETH_RESOLVER_CONTRACT=$ETH_RESOLVER_ADDRESS
STELLAR_RESOLVER_CONTRACT=$STELLAR_RESOLVER_ID

# Network Configuration
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# 1inch Integration
ONEINCH_API_KEY=your_api_key_here
ONEINCH_ORDER_API=wss://api.1inch.dev/fusion/orders

# Service Configuration
PORT=3001
LOG_LEVEL=info
EOF

# Start the monitoring service (optional)
npm run monitor:dev
```

### 3. Frontend Configuration

```bash
cd frontend

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_RESOLVER_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_CONTRACT_ID=$STELLAR_CONTRACT_ID
NEXT_PUBLIC_ETHEREUM_NETWORK=sepolia
NEXT_PUBLIC_ETHEREUM_ESCROW_FACTORY=0x...
EOF

# Install dependencies
npm install

# Start the frontend
npm run dev
```

### 4. 1inch API Proxy Setup

Due to browser CORS restrictions, you need a proxy server for 1inch API calls:

```bash
# The proxy is included in the project
# Start it separately or use the all-in-one script:
npm run proxy:dev

# Or start all services together:
./start-local.sh
```

The proxy handles:
- CORS headers for browser requests
- API key injection
- Request forwarding to 1inch API
- Error handling and logging

## Testing Approach

**Important**: 1inch Fusion+ has no testnet. All testing uses:
- Local Hardhat mainnet fork
- Mock resolver system
- Impersonated accounts with forked balances

```bash
# Run the complete demo
./scripts/1inch/run-demo.sh

# Or start components individually:
npm run fork        # Hardhat mainnet fork
npm run proxy:dev   # API proxy
npm run resolver:dev # Resolver service
npm run dev         # Frontend
```

## Updated Wallet Integration

### 1. MetaMask Setup with Secret Generation

```typescript
// src/hooks/useMetaMask.ts
import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

export const useMetaMask = () => {
  const connect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    
    return { provider, signer };
  };
  
  // NEW: User generates secret for cross-chain swap
  const generateSwapSecret = () => {
    const secret = randomBytes(32);
    const hashlock = ethers.keccak256(secret);
    return { secret: ethers.hexlify(secret), hashlock };
  };
  
  return { connect, generateSwapSecret };
};
```

### 2. Freighter Setup (Stellar)

```typescript
// src/hooks/useFreighter.ts
import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

export const useFreighter = () => {
  const connect = async () => {
    if (!await isConnected()) {
      alert('Please install Freighter wallet!');
      return;
    }
    
    const publicKey = await getPublicKey();
    return { publicKey };
  };
  
  return { connect };
};
```

## Updated API Flow

### 1. Create Order with User's Secret
```typescript
// Frontend creates order with user's hashlock
const { secret, hashlock } = generateSwapSecret();

const order = await fusionSDK.createOrder({
  // ... order parameters
  hashLock: hashlock, // User's hashlock, not resolver's!
});

// Store secret securely client-side
localStorage.setItem(`secret-${order.orderHash}`, secret);
```

### 2. Resolver Fills Order (Smart Contract)
```solidity
// Resolver contract fills order atomically
resolverContract.deploySrc(
  immutables,
  order,
  signature,
  takerTraits,
  amount
);
```

### 3. User Reveals Secret
```typescript
// User reveals secret to withdraw on destination
const secret = localStorage.getItem(`secret-${orderHash}`);
await destinationEscrow.withdraw(secret);
```

## Testing the Integration

### 1. Start All Services

```bash
# Terminal 1: Resolver Service
cd src/services/resolver
npm run dev

# Terminal 2: Frontend
cd frontend  
npm run dev

# Terminal 3: Monitor logs
docker-compose -f docker-compose.resolver.yml logs -f
```

### 2. Create a Test Swap

1. Open http://localhost:3000 in your browser
2. Connect both MetaMask (Ethereum) and Freighter (Stellar) wallets
3. Select source chain, token, and amount
4. Select destination chain and token
5. Click "Swap" and approve transactions

### 3. Monitor Progress

The resolver service will:
1. Detect the source chain escrow creation
2. Deploy the corresponding destination chain escrow
3. Monitor for secret reveal
4. Complete the swap automatically

## Troubleshooting

### Common Issues

1. **Wallet Connection Failed**
   - Ensure wallets are installed and unlocked
   - Check network settings match testnet configuration

2. **Transaction Failed**
   - Verify sufficient balance for gas fees
   - Check token allowances are set

3. **Resolver Not Detecting Events**
   - Verify contract addresses in .env files
   - Check RPC endpoints are accessible
   - Review resolver logs for errors

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Manual Testing

Test individual components:
```bash
# Test Stellar connection
stellar contract invoke \
  --id $STELLAR_CONTRACT_ID \
  --source YOUR_SECRET_KEY \
  --network testnet \
  -- \
  view_escrow \
  --escrow_id "0x..."

# Test resolver health
curl http://localhost:3001/health
```

## Production Considerations

1. **Security**
   - Use hardware wallets or KMS for production keys
   - Enable HTTPS for all endpoints
   - Implement rate limiting

2. **Monitoring**
   - Set up Grafana dashboards
   - Configure alerts for failed swaps
   - Monitor gas prices and fees

3. **High Availability**
   - Deploy resolver to multiple regions
   - Use database replication
   - Implement automatic failover

## Next Steps

1. Deploy contracts to mainnet
2. Set up production infrastructure
3. Conduct security audit
4. Create user documentation
5. Launch bug bounty program