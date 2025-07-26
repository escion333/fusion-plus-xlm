# Fusion+ Resolver Service

The resolver service monitors cross-chain escrow events and orchestrates atomic swaps between Ethereum and Stellar networks.

## Architecture

### Core Components

1. **ResolverService** - Main service orchestrator
2. **Chain Monitors** - Network-specific event monitoring
   - EthereumMonitor - EVM chain monitoring
   - StellarMonitor - Stellar/Soroban monitoring
3. **SecretManager** - Cryptographic secret generation and management
4. **TimelockManager** - Timelock tracking and expiration handling
5. **SwapOrchestrator** - Cross-chain swap coordination

### Event Flow

1. User creates escrow on source chain (e.g., Ethereum)
2. Monitor detects `EscrowCreated` event
3. Resolver generates secret and deploys counterpart escrow on destination chain
4. When destination is funded, resolver reveals secret
5. Both parties can withdraw using the revealed secret
6. Timelocks ensure funds can be recovered if swap fails

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for job queuing)
- Ethereum wallet with ETH for gas
- Stellar account with XLM for fees

### Configuration

Create `.env.local` file:

```env
# Resolver account (needs funds on both chains)
RESOLVER_ADDRESS=0x...
RESOLVER_PRIVATE_KEY=0x...

# Chains to monitor
RESOLVER_CHAINS=sepolia,stellarTestnet

# RPC endpoints
SEPOLIA_RPC_URL=https://rpc.sepolia.org
STELLAR_TESTNET_RPC_URL=https://soroban-testnet.stellar.org

# Contract addresses
SEPOLIA_ESCROW_FACTORY=0x...
STELLAR_TESTNET_ESCROW_CONTRACT=C...

# Database
DATABASE_URL=postgresql://localhost/fusion_resolver
```

### Running Locally

1. Start dependencies:
```bash
docker-compose -f docker-compose.resolver.yml up -d postgres redis
```

2. Install packages:
```bash
npm install
```

3. Build TypeScript:
```bash
npm run build
```

4. Run resolver:
```bash
npm run resolver
```

### Running with Docker

```bash
docker-compose -f docker-compose.resolver.yml up
```

## Monitoring

The resolver logs important events and metrics:

- Escrow creation events
- Secret reveals
- Withdrawals and cancellations
- Timelock expirations
- Error conditions

Check logs in `./logs/` directory or use your preferred log aggregation service.

## Security Considerations

1. **Private Key Security**: Store resolver private key in secure key management service
2. **Secret Management**: Secrets are generated using cryptographically secure random bytes
3. **Access Control**: Only authorized addresses can withdraw/cancel escrows
4. **Timelock Enforcement**: Automatic handling of timelock expirations
5. **Event Verification**: All chain events are verified before processing

## Testing

Run tests:
```bash
npm test src/services/resolver
```

Integration test with local chains:
```bash
npm run test:integration:resolver
```

## Troubleshooting

### Common Issues

1. **"No monitor for chain"** - Check RESOLVER_CHAINS configuration
2. **"Failed to deploy escrow"** - Ensure resolver has sufficient funds
3. **"Transaction timeout"** - Check RPC endpoint connectivity
4. **Database connection errors** - Verify PostgreSQL is running

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Architecture Decisions

1. **Event-driven architecture** - Reactive to chain events for reliability
2. **Idempotent operations** - Safe to retry failed operations
3. **State persistence** - Database tracks swap state across restarts
4. **Graceful shutdown** - Completes in-flight operations before exit
5. **Chain abstraction** - Easy to add new chains via monitor interface

## Adding New Chains

1. Create new monitor extending `BaseMonitor`
2. Implement required methods for chain interaction
3. Add chain configuration to `chains.ts`
4. Update `ResolverService` to instantiate new monitor

## Performance

- Processes ~100 swaps/minute per chain
- Sub-second event detection with 5s polling
- Automatic retry with exponential backoff
- Connection pooling for database and RPC

## Roadmap

- [ ] Merkle tree support for partial fills
- [ ] Multi-resolver coordination
- [ ] MEV protection strategies
- [ ] Advanced fee optimization
- [ ] Prometheus metrics export