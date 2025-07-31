# Stellar Fusion+ Build Plan

## Overview

This document outlines the complete build plan for extending 1inch's cross-chain resolver example to support Stellar. We'll build on their existing Ethereum ↔ BSC example to create Ethereum ↔ Stellar cross-chain swaps.

## Prerequisites

1. **Get 1inch Example Working**
   ```bash
   cd docs/external-docs/cross-chain-resolver-example
   npm install
   npm test  # Ensure Ethereum ↔ BSC swaps work
   ```

2. **Understand Their Architecture**
   - Resolver smart contracts that fill orders
   - Mock relayer service for coordination
   - HTLC contracts for atomic swaps
   - Secret flow: User → Relayer → Resolver

## Phase 1: Foundation (Days 1-2)

### 1.1 Study 1inch Example
- [ ] Run their tests successfully
- [ ] Understand resolver contract pattern
- [ ] Trace the complete swap flow
- [ ] Document differences for Stellar

### 1.2 Set Up Development Environment
- [ ] Stellar CLI and Soroban SDK
- [ ] Local Stellar network
- [ ] Integration test environment
- [ ] Connect to existing example

## Phase 2: Stellar Smart Contracts (Days 3-5)

### 2.1 Stellar Resolver Contract
Create `stellar-fusion/resolver/` with:

```rust
// resolver.rs
pub struct ResolverContract;

#[contractimpl]
impl ResolverContract {
    // Initialize with owner and HTLC factory reference
    pub fn initialize(env: Env, owner: Address, htlc_contract: Address);
    
    // Deploy escrow (no LOP on Stellar, direct deployment)
    pub fn deploy_escrow(
        env: Env,
        order_hash: BytesN<32>,
        immutables: Immutables
    ) -> Result<Address, Error>;
    
    // Fund escrow with tokens
    pub fn fund_escrow(
        env: Env,
        escrow: Address,
        token: Address,
        amount: i128
    );
    
    // Withdraw using revealed secret
    pub fn withdraw(
        env: Env,
        escrow: Address,
        secret: BytesN<32>
    );
    
    // Cancel escrow after timelock
    pub fn cancel(env: Env, escrow: Address);
}
```

### 2.2 Update HTLC Contract
Ensure compatibility with resolver:
- [ ] Add resolver-specific access controls
- [ ] Ensure event emission works
- [ ] Test with resolver contract

### 2.3 Deployment Scripts
```bash
# scripts/deploy-stellar-resolver.sh
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/resolver.wasm \
  --source $RESOLVER_KEY \
  --network mainnet
```

## Phase 3: Extend Relayer Service (Days 6-7)

### 3.1 Add Stellar Support to Mock Relayer

```typescript
// Extend their existing relayer
class ExtendedRelayer extends MockRelayer {
  private stellarMonitor: StellarMonitor;
  
  async handleOrder(order: CrossChainOrder) {
    if (order.dstChainId === STELLAR_CHAIN_ID) {
      return this.handleStellarDestination(order);
    }
    if (order.srcChainId === STELLAR_CHAIN_ID) {
      return this.handleStellarSource(order);
    }
    return super.handleOrder(order);
  }
  
  async handleStellarDestination(order: CrossChainOrder) {
    // 1. Wait for Ethereum escrow
    // 2. Deploy Stellar escrow
    // 3. Fund Stellar escrow
    // 4. Wait for secret reveal
  }
  
  async monitorStellarEvents() {
    // Monitor for SecretRevealed events on Stellar
  }
}
```

### 3.2 Stellar Chain Monitor
```typescript
class StellarMonitor {
  async watchForEvents(contractId: string) {
    // Poll Soroban events
    // Detect SecretRevealed
    // Notify relayer
  }
  
  async deployEscrow(params: EscrowParams) {
    // Call Stellar resolver contract
  }
}
```

## Phase 4: Integration (Days 8-9)

### 4.1 Order Creation with Stellar
```typescript
// Extend order creation for Stellar
function createStellarOrder(params: OrderParams): CrossChainOrder {
  return new CrossChainOrder({
    srcChainId: ETHEREUM_CHAIN_ID,
    dstChainId: STELLAR_CHAIN_ID,
    srcToken: params.srcToken,
    dstToken: stellarTokenToAddress(params.dstToken),
    // ... other params
    whitelist: [{
      address: OUR_RESOLVER_ADDRESS,
      allowFrom: 0
    }]
  });
}
```

### 4.2 Address Translation
```typescript
// Map between Ethereum (20 bytes) and Stellar (32 bytes) addresses
class AddressMapper {
  evmToStellar(evmAddress: string): string;
  stellarToEvm(stellarAddress: string): string;
}
```

### 4.3 Token Mapping
```typescript
// Map common tokens between chains
const TOKEN_MAPPING = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  stellar: {
    USDC: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
    XLM: "native"
  }
};
```

## Phase 5: Testing (Days 10-11)

### 5.1 Unit Tests
- [ ] Stellar resolver contract tests
- [ ] Relayer Stellar extension tests
- [ ] Address/token mapping tests

### 5.2 Integration Tests
```typescript
describe('Ethereum -> Stellar Swap', () => {
  it('should complete USDC swap', async () => {
    // 1. Create order
    const order = createStellarOrder({
      srcToken: 'USDC',
      dstToken: 'XLM',
      amount: '100'
    });
    
    // 2. Fill order
    await resolver.fillOrder(order);
    
    // 3. Verify escrows created
    // 4. Reveal secret
    // 5. Verify completion
  });
});
```

### 5.3 Mainnet Testing Checklist
- [ ] Deploy contracts to mainnet
- [ ] Test with small amounts first
- [ ] Verify gas costs reasonable
- [ ] Test timeout scenarios
- [ ] Test cancellation flow

## Phase 6: UI Integration (Days 12-13)

### 6.1 Update Frontend
- [ ] Add Stellar chain option
- [ ] Integrate Freighter wallet
- [ ] Show Stellar addresses correctly
- [ ] Handle XLM and Stellar assets

### 6.2 Order Creation Flow
```typescript
// Frontend flow
async function createCrossChainSwap() {
  // 1. User selects Ethereum -> Stellar
  // 2. Connects both wallets
  // 3. Generates secret client-side
  const secret = generateSecret();
  const hashlock = keccak256(secret);
  
  // 4. Creates order with our resolver
  const order = await createOrder({
    hashlock,
    whitelist: [OUR_RESOLVER]
  });
  
  // 5. Signs with MetaMask
  const signature = await signOrder(order);
  
  // 6. Submits to our relayer
  await relayer.submitOrder(order, signature);
}
```

## Phase 7: Demo Preparation (Day 14)

### 7.1 Demo Script
1. Show working 1inch example (Ethereum ↔ BSC)
2. Explain Stellar extension architecture
3. Live demo: Ethereum USDC → Stellar XLM
4. Show contracts on block explorers
5. Explain production path

### 7.2 Key Talking Points
- First Stellar integration with 1inch Fusion+
- Built on official 1inch patterns
- Working on mainnet
- Path to production with real relayer

## Key Files to Create/Modify

### New Files
```
stellar-fusion/resolver/
├── Cargo.toml
├── src/
│   ├── lib.rs          # Resolver contract
│   ├── types.rs        # Stellar-specific types
│   └── test.rs         # Contract tests

src/services/stellar/
├── StellarMonitor.ts   # Event monitoring
├── StellarResolver.ts  # Resolver interface
└── AddressMapper.ts    # Address translation

src/relayer/
├── ExtendedRelayer.ts  # Extended mock relayer
└── StellarHandler.ts   # Stellar-specific logic
```

### Modified Files
```
- package.json                    # Add Stellar dependencies
- src/relayer/MockRelayer.ts     # Extend for Stellar
- src/types/chains.ts            # Add Stellar chain
- tests/integration.test.ts      # Add Stellar tests
```

## Success Metrics

1. **Working Demo**: Ethereum ↔ Stellar swaps functioning
2. **Mainnet Ready**: Deployed and tested on mainnet
3. **Clean Integration**: Follows 1inch patterns
4. **Documentation**: Clear explanation of extensions
5. **Innovation**: First non-EVM integration

## Timeline Summary

- **Days 1-2**: Foundation and understanding
- **Days 3-5**: Stellar smart contracts  
- **Days 6-7**: Relayer extensions
- **Days 8-9**: Integration work
- **Days 10-11**: Testing
- **Days 12-13**: UI updates
- **Day 14**: Demo preparation

## Next Steps

1. Start with getting their example fully working
2. Begin Stellar resolver contract development
3. Extend relayer incrementally
4. Test each component thoroughly
5. Prepare impressive demo

---

*Remember: The goal is to extend their example correctly, not rebuild everything. Focus on the Stellar-specific additions while maintaining their architecture patterns.*