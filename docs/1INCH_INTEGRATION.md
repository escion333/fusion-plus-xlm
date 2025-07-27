# 1inch Fusion+ Integration Documentation

## Overview

This document describes the integration of 1inch Fusion+ protocol with our Stellar cross-chain swap infrastructure, creating the first implementation of 1inch Fusion+ on the Stellar blockchain.

## Architecture

### Components

1. **1inch API Proxy Server** (Port 3002)
   - Handles CORS for frontend
   - Forwards requests to 1inch APIs
   - Provides mock endpoints for demo

2. **Fusion SDK Service**
   - Creates cross-chain orders
   - Manages order lifecycle
   - Handles Dutch auction parameters

3. **Mock Resolver System**
   - Simulates resolver behavior
   - Demonstrates Dutch auction mechanics
   - Executes cross-chain swaps

4. **Order Builder**
   - Constructs properly formatted orders
   - Handles cross-chain extensions
   - Manages timelocks and hashlocks

## Quick Start

### 1. Start the Infrastructure

```bash
# Terminal 1: Start Hardhat mainnet fork
npm run fork

# Terminal 2: Start 1inch proxy server
npm run proxy:dev

# Terminal 3: Start resolver service
npm run resolver:dev

# Terminal 4: Start frontend
npm run dev
```

### 2. Run the Demo

```bash
# Run complete demo scenario
./scripts/1inch/run-demo.sh
```

## API Endpoints

### Proxy Server (http://localhost:3002)

- `GET /health` - Health check
- `GET /api/1inch/*` - 1inch API proxy
- `GET /api/fusion/*` - Fusion API proxy
- `GET /api/mock/fusion/orders/active` - Mock active orders
- `POST /api/mock/fusion/orders/create` - Mock order creation
- `GET /api/mock/quote` - Mock quote endpoint

## Order Flow

### 1. Order Creation

```typescript
// User creates cross-chain order
const order = {
  maker: "0x...",
  makerAsset: "0xA0b8699...", // USDC on Ethereum
  takerAsset: "native", // XLM on Stellar
  makingAmount: "1000000000", // 1000 USDC
  takingAmount: "2000000000", // 2000 XLM
  crossChain: {
    enabled: true,
    destinationChain: "stellar",
    stellarReceiver: "GB3MTYF..."
  }
};
```

### 2. Dutch Auction

The order enters a Dutch auction where the price improves over time:

```
Start: 2000 XLM required
After 1 min: 1980 XLM required (1% improvement)
After 5 min: 1900 XLM required (5% improvement)
```

### 3. Resolver Claims Order

Mock resolver monitors orders and claims when profitable:

```typescript
// Resolver checks profitability
if (expectedProfit > gassCosts + 2%) {
  claimOrder(order);
}
```

### 4. Escrow Creation

Resolver creates escrows on both chains:

```
Ethereum Escrow:
- Locks user's USDC
- Hashlock: keccak256(secret)
- Timelocks: 7-stage progression

Stellar Escrow:
- Locks resolver's XLM
- Same hashlock
- Compatible timelocks
```

### 5. Swap Execution

1. Wait for finality on both chains
2. Resolver reveals secret on Stellar
3. User sees secret and withdraws on Ethereum
4. Swap complete!

## Configuration

### Environment Variables

```env
# Ethereum RPC (use your own for better performance)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# 1inch API Key (optional - get from https://portal.1inch.dev)
ONEINCH_API_KEY=your_api_key_here

# Proxy server port
PROXY_PORT=3002
```

### Mock Resolver Settings

```typescript
// In MockResolver.ts
const RESOLVER_CONFIG = {
  minProfit: 2, // Minimum 2% profit
  maxGasPrice: 100, // Max 100 gwei
  auctionCheckInterval: 5000, // Check every 5 seconds
};
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:resolver
npm run test:1inch
```

### Integration Test

```bash
# Run cross-chain integration test
npx hardhat run scripts/1inch/demo-scenario.ts --network localhost
```

## Production Considerations

### 1. Resolver Whitelisting

Production resolvers must be KYC'd and whitelisted by 1inch:

1. Apply at https://portal.1inch.dev
2. Complete KYC process
3. Get resolver address whitelisted
4. Receive production API credentials

### 2. Capital Requirements

Resolvers need sufficient capital on both chains:

- Ethereum: ETH for gas + token liquidity
- Stellar: XLM for operations + token liquidity

### 3. Security

- Audit smart contracts before mainnet
- Implement rate limiting
- Monitor for unusual activity
- Use secure key management

### 4. Performance

- Use dedicated RPC endpoints
- Implement caching for quotes
- Optimize gas usage
- Monitor mempool for MEV

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure proxy server is running
   - Check proxy configuration
   - Verify API endpoints

2. **Order Creation Fails**
   - Check wallet connections
   - Verify token approvals
   - Ensure sufficient balance

3. **Resolver Not Claiming**
   - Check profitability settings
   - Verify gas price limits
   - Monitor auction parameters

4. **Mock Data Only**
   - No API key configured
   - Using fallback endpoints
   - Check .env file

## Demo Script Output

When running the demo, you'll see:

```
🚀 Starting Cross-Chain Swap Demo

Scenario: Swap 1000 USDC (Ethereum) → XLM (Stellar)

===========================================================
📍 Step 1: Create Cross-Chain Fusion+ Order
   User creates an order to swap USDC on Ethereum for XLM on Stellar
===========================================================

📝 Building cross-chain order...
✅ Order created:
   Order Hash: 0x123...
   Source: 1000 USDC (Ethereum)
   Destination: 2000 XLM (Stellar)

[... continues through all steps ...]

✅ Demo completed successfully!
```

## Next Steps

1. **Get 1inch API Key**
   - Register at https://portal.1inch.dev
   - Add to .env file

2. **Deploy to Testnet**
   - Deploy Stellar contract
   - Deploy EVM contracts
   - Test full flow

3. **Create Demo Video**
   - Record frontend interaction
   - Show order flow
   - Highlight Stellar innovation

4. **Prepare for Production**
   - Complete security audit
   - Apply for resolver status
   - Set up monitoring

## Resources

- [1inch Fusion+ Docs](https://docs.1inch.io/docs/fusion-swap/introduction)
- [1inch Developer Portal](https://portal.1inch.dev)
- [Stellar Soroban Docs](https://soroban.stellar.org)
- [Project Repository](https://github.com/your-repo)

---

**Created for**: Stellar Fusion+ Hackathon
**Last Updated**: January 2025