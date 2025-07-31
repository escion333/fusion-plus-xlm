# Extended Cross-Chain Resolver with Stellar Support

This directory contains our extension of the 1inch cross-chain resolver example to support Stellar blockchain.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  1inch Order    │────▶│ Extended Relayer │────▶│ Stellar Monitor │
│     System      │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        │                        │                         │
        ▼                        ▼                         ▼
   User Creates            Handles Both:              Manages:
   Order with              - ETH ↔ BSC (base)        - Escrow Deploy
   Hashlock                - ETH ↔ Stellar (new)      - Fund Transfer
                           - Stellar ↔ ETH (new)      - Secret Monitor
```

## Key Components

### 1. ExtendedRelayer
- Extends the 1inch MockRelayer class
- Adds logic to handle Stellar as source or destination
- Routes orders to appropriate handlers

### 2. StellarMonitor
- Monitors Stellar blockchain for events
- Deploys and funds escrows on Stellar
- Watches for secret reveals
- Handles address translation between chains

### 3. Stellar Resolver Contract
- Located in `../stellar-resolver/`
- Soroban smart contract that mirrors Ethereum resolver functionality
- Manages escrow deployment and withdrawals on Stellar

## How It Works

### Ethereum → Stellar Swap
1. User creates order with their hashlock on Ethereum
2. Resolver fills order via LOP (triggers Ethereum escrow)
3. ExtendedRelayer detects Stellar as destination
4. StellarMonitor deploys matching escrow on Stellar
5. StellarMonitor funds the Stellar escrow
6. User reveals secret on Stellar
7. Resolver uses revealed secret to withdraw on Ethereum

### Stellar → Ethereum Swap
1. User creates order with their hashlock (adapted for Stellar)
2. Resolver deploys escrow on Stellar
3. ExtendedRelayer detects and deploys Ethereum escrow
4. User reveals secret on Ethereum
5. Resolver uses revealed secret to withdraw on Stellar

## Integration Points

### Chain IDs
- Ethereum: 1 (standard)
- BSC: 56 (standard) 
- Stellar: 1001 (custom for this integration)

### Token Mapping
- Ethereum USDC ↔ Stellar USDC
- Ethereum ETH ↔ Stellar XLM (native)

### Address Translation
- 20-byte EVM addresses ↔ 32-byte Stellar addresses
- Deterministic mapping for cross-chain coordination

## Running the Demo

```bash
# Install dependencies
npm install

# Run the demo
npm run demo
```

## Next Steps for Production

1. **Implement actual Stellar contract calls** - Replace mock implementations with real Soroban contract interactions
2. **Add proper event monitoring** - Use Stellar Horizon API for real-time event tracking
3. **Implement address mapping** - Create deterministic address translation
4. **Add error handling** - Handle network issues, timeouts, and edge cases
5. **Security audit** - Review all secret handling and transaction flows

## Key Innovation

This is the first integration of a non-EVM blockchain (Stellar) with the 1inch Fusion+ protocol, demonstrating that the cross-chain swap architecture can extend beyond EVM-compatible chains.