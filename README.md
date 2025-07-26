# Stellar Fusion+ Cross-Chain Swap

First implementation of 1inch Fusion+ protocol for Stellar blockchain, enabling trustless cross-chain swaps between Ethereum and Stellar networks.

## Project Status

### ✅ Completed
- **Frontend Interface**: Clean swap UI with wallet integration
  - Token selection (ETH, USDC, USDT on Ethereum; XLM, USDC on Stellar)
  - Chain selection with switching functionality
  - Amount input with validation
  - MetaMask and Freighter wallet integration
  - Connection to resolver API endpoints
  - Real-time resolver status display
  - Professional UI using Next.js 14, TypeScript, Tailwind CSS, and Shadcn/ui

- **Stellar HTLC Contract**: Fully implemented and tested (14/14 tests passing)
  - Escrow creation with deterministic addressing
  - Withdraw/cancel functionality with proper timelock enforcement
  - Safety deposit mechanism
  - Compatible with 1inch Fusion+ protocol structure
  - 7-stage timelock management with bit-packing
  - Event emission for resolver monitoring
  - Native XLM token support
  - Optimized WASM binary (6.7KB)

- **Resolver Service**: Complete implementation with tests (24/24 tests passing)
  - Cross-chain event monitoring (Ethereum + Stellar)
  - Automated counterpart escrow deployment
  - Secret generation and management
  - Timelock tracking and enforcement
  - High availability architecture
  - Database persistence with PostgreSQL
  - Docker support for easy deployment
  - RESTful API for frontend integration

- **1inch Fusion+ Integration**: Complete implementation
  - API proxy server for CORS handling
  - Fusion SDK integration for order creation
  - Mock resolver system demonstrating Dutch auction
  - Cross-chain flow simulation
  - Order builder with proper formatting
  - Frontend integration with quote fetching

### 🚧 In Progress
- Contract deployment to testnets (Stellar testnet and Ethereum Sepolia)
- End-to-end cross-chain testing with real networks
- Demo video creation

## Prerequisites

### 1inch API Key Setup
To use the 1inch integration features:
1. Visit the 1inch Developer Portal during the hackathon
2. Click "Claim API key" button to get your hackathon API key
3. Add the key to your `.env` file:
   ```bash
   ONEINCH_API_KEY=your_api_key_here
   ```
   
**Note**: Hackathon API keys will be disabled after the event.

## Quick Start

### 🚀 One-Command Start (Recommended)
```bash
# Start all services with Docker
./start-local.sh

# Services will be available at:
# - Frontend: http://localhost:3000
# - Resolver API: http://localhost:3001
# - 1inch Proxy: http://localhost:3002
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

### 1inch Integration Demo
```bash
# Run the complete 1inch Fusion+ demo
./scripts/1inch/run-demo.sh

# Or start services individually:
npm run fork          # Start Hardhat mainnet fork
npm run proxy:dev     # Start 1inch API proxy
npm run resolver:dev  # Start resolver service
npm run dev          # Start frontend
```

**Important**: 1inch Fusion+ has no testnet. All testing uses a local mainnet fork with mock resolvers.

### Manual Setup

#### Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

#### Stellar Contract
```bash
cd stellar-fusion
cargo test
# All 14 tests should pass
```

#### Resolver Service
```bash
# Install dependencies
npm install

# Run tests
npm run test:resolver

# Start with Docker
docker-compose -f docker-compose.resolver.yml up

# Or run locally
npm run resolver:dev
```

## Testing Approach

Due to 1inch Fusion+ limitations:
- **No Testnet**: 1inch Fusion+ doesn't have a testnet environment
- **No Live Counterparties**: Testing requires mock resolvers
- **Mainnet Fork**: All testing uses Hardhat mainnet fork with impersonated accounts
- **API Proxy Required**: Browser CORS restrictions require proxy server

For production testing assistance, contact the 1inch team directly.

## Architecture

This project implements the 1inch Fusion+ protocol for cross-chain swaps between Ethereum and Stellar:

1. **Source Chain (Ethereum)**: User locks tokens in escrow with hashlock
2. **Resolver**: Monitors events and facilitates the swap
3. **Destination Chain (Stellar)**: Resolver locks tokens, user withdraws with secret
4. **Completion**: Secret revealed allows resolver to withdraw on source chain

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui
- **Stellar**: Soroban smart contracts (Rust)
- **Ethereum**: 1inch cross-chain-swap contracts
- **Integration**: ethers.js, stellar-sdk

## Documentation

### Integration & Deployment
- [Integration Guide](docs/INTEGRATION_GUIDE.md) - Connect all components
- [Testnet Deployment Guide](docs/TESTNET_DEPLOYMENT.md) - Deploy to testnets
- [Documentation Status](DOCUMENTATION_STATUS.md) - Current docs overview

### Implementation Plans
- [Project Specification](docs/ai-plans/spec.md)
- [Stellar Contract Implementation](docs/ai-plans/stellar-fusion-implementation-plan.md) ✅
- [Resolver Service Plan](docs/ai-plans/resolver-service-plan.md) ✅
- [UI Implementation Plan](docs/ai-plans/ui-swap-visualization-plan.md) ✅
- [Partial Fills (Merkle Tree)](docs/ai-plans/partial-fills-merkle-plan.md) 📋
- [Mainnet Deployment Plan](docs/ai-plans/mainnet-deployment-plan.md) 📋

### Technical Documentation
- [Stellar Contract Features](stellar-fusion/FEATURE_SUMMARY.md)
- [Stellar Test Results](stellar-fusion/TEST_RESULTS.md)
- [Resolver Service README](src/services/resolver/README.md)
- [Resolver Test Results](src/services/resolver/TEST_RESULTS.md)
- [Build Test Results Summary](TEST_RESULTS_SUMMARY.md)

### Internal Guides
- [Quick Start Guide](docs/internal-docs/quick-start-checklist.md)
- [Hackathon Strategy](docs/internal-docs/hackathon-strategy.md)
- [AI Collaboration Guide](docs/internal-docs/CLAUDE.md)

## Hackathon Target

This project targets the 1inch Priority Fusion+ (Stellar) bounty worth $12,000.

## 🧪 Verify The Project Works

Not sure if everything is working? Check out:
- [Quick Test Checklist](QUICK_TEST_CHECKLIST.md) - 5-minute verification
- [Detailed Verification Guide](VERIFICATION_GUIDE.md) - Step-by-step testing