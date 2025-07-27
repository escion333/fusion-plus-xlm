# Stellar Fusion+ Integration Guide

This guide explains how to connect all components of the Stellar Fusion+ cross-chain swap protocol.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Frontend (UI)  │────▶│ Resolver Service │────▶│ Smart Contracts │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        │                        │                         │
        ▼                        ▼                         ▼
   MetaMask &              Redis + DB              Ethereum & Stellar
   Freighter                                         Blockchains
```

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

### 2. Resolver Service Setup

```bash
cd src/services/resolver

# Create .env file
cat > .env << EOF
# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_CONTRACT_ID=$STELLAR_CONTRACT_ID
STELLAR_RESOLVER_SECRET=YOUR_STELLAR_SECRET_KEY

# Ethereum Configuration  
ETHEREUM_NETWORK=sepolia
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETHEREUM_RESOLVER_ADDRESS=0x...
ETHEREUM_RESOLVER_PRIVATE_KEY=0x...

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fusion
REDIS_URL=redis://localhost:6379

# Service Configuration
PORT=3001
LOG_LEVEL=info

# 1inch API Configuration
ONEINCH_API_KEY=your_api_key_here
EOF

# Start dependencies
docker-compose -f ../../../docker-compose.resolver.yml up -d

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start the resolver service
npm run dev
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

## Wallet Integration

### 1. MetaMask Setup (Ethereum)

Add the following to your frontend:

```typescript
// src/hooks/useMetaMask.ts
import { ethers } from 'ethers';

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
  
  return { connect };
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

## API Endpoints

The resolver service exposes the following endpoints:

### Health Check
```
GET http://localhost:3001/health
```

### Create Swap
```
POST http://localhost:3001/api/swaps
Content-Type: application/json

{
  "sourceChain": "ethereum",
  "destChain": "stellar",
  "sourceToken": "0x...",
  "destToken": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  "amount": "1000000000000000000",
  "maker": "0x...",
  "taker": "G..."
}
```

### Get Swap Status
```
GET http://localhost:3001/api/swaps/{swapId}
```

### List Active Swaps
```
GET http://localhost:3001/api/swaps?status=active
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