# 1inch Cross-Chain Resolver Architecture Notes

## Key Components

### 1. Resolver Smart Contract (Solidity)
- **deploySrc()**: Fills order via LOP + deploys source escrow atomically
- **deployDst()**: Deploys destination escrow  
- **withdraw()**: Uses user-revealed secret to withdraw
- **cancel()**: Cancels escrow after timelock

### 2. Test Flow
1. User generates secret and creates order with hashlock
2. Resolver calls deploySrc() which:
   - Sends safety deposit to future escrow address
   - Fills order through LOP (triggers escrow deployment)
3. Resolver calls deployDst() on destination chain
4. User reveals secret by withdrawing on destination
5. Resolver uses revealed secret to withdraw on source

### 3. Key Differences for Stellar
- No LOP on Stellar - need different order filling mechanism
- Address format: 32-byte Stellar vs 20-byte EVM
- Asset handling: XLM native vs wrapped tokens
- Transaction model: Different from EVM

## Our Extension Plan

### Phase 1: Stellar Resolver Contract (Days 3-5)
```rust
// Similar structure to Solidity resolver
pub fn deploy_escrow(env: Env, immutables: Immutables) -> Address;
pub fn fund_escrow(env: Env, escrow: Address, amount: i128);
pub fn withdraw(env: Env, escrow: Address, secret: BytesN<32>);
pub fn cancel(env: Env, escrow: Address);
```

### Phase 2: Extend MockRelayer (Days 6-7)
```typescript
class ExtendedRelayer extends MockRelayer {
  async handleOrder(order: CrossChainOrder) {
    if (order.dstChainId === STELLAR_CHAIN_ID) {
      return this.handleStellarDestination(order);
    }
    return super.handleOrder(order);
  }
}
```

### Phase 3: Integration (Days 8-11)
- Address mapping between chains
- Token mapping (USDC, XLM)
- Order creation for Stellar
- Full flow testing

## Next Steps
1. Create Stellar resolver contract
2. Test with our existing HTLC
3. Extend their MockRelayer
4. Run full cross-chain test