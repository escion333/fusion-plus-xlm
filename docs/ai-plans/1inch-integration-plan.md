# 1inch Fusion+ Integration Plan

## 🏆 Hackathon Focus: Stellar Extension Demo

This plan focuses on demonstrating Stellar integration with 1inch Fusion+ for the hackathon by extending their cross-chain resolver example.

## Hackathon Objective

### Primary Goal
Build a compelling demo showing Ethereum ↔ Stellar cross-chain swaps by:
1. **Extending 1inch's resolver example** to support Stellar
2. **Using their mock relayer** with our resolver whitelisted
3. **Creating local orders** (no API access needed)
4. **Demonstrating on mainnet** for high impact

### Success Criteria
- [ ] Get 1inch example working locally (Ethereum ↔ BSC)
- [ ] Add Stellar support to their architecture
- [ ] Demo successful cross-chain swap
- [ ] Show innovative non-EVM integration
- [ ] Prepare impressive presentation

## Hackathon Approach

### What 1inch Provides
1. **Mock relayer** - They have one we can use
2. **Resolver whitelisting** - Our resolver can be added
3. **Example code** - Working Ethereum ↔ BSC implementation
4. **Local order creation** - No API needed

### Our Extension Strategy

### 1. Study & Run Their Example
**First Priority**: Get their code working

**Steps**:
```bash
# Clone and run their example
git clone https://github.com/1inch/cross-chain-resolver-example
cd cross-chain-resolver-example
npm install
npm test  # Ensure Ethereum ↔ BSC works
```

### 2. Add Stellar Support
**Main Task**: Extend to support Stellar

**Key Components**:
1. Stellar resolver contract (Soroban)
2. Stellar chain monitor
3. Address/asset mapping
4. Integration with mock relayer

### 3. Demo Flow
**Goal**: Show working cross-chain swap

**Steps**:
1. Create order locally with our resolver
2. Fill on Ethereum via their system
3. Deploy on Stellar via our extension
4. Complete swap successfully

## Hackathon Tasks (14-Day Sprint)

### [ ] Days 1-2: Foundation
  - [ ] Get 1inch example working locally
  - [ ] Understand their resolver pattern
  - [ ] Trace complete swap flow
  - [ ] Set up Stellar development environment
  - [ ] Document differences for Stellar

### [ ] Days 3-5: Stellar Smart Contracts
  - [ ] Build Stellar resolver contract
    - [ ] Initialize with HTLC reference
    - [ ] Deploy escrow function
    - [ ] Fund escrow function
    - [ ] Withdraw with secret
    - [ ] Cancel after timelock
  - [ ] Update existing HTLC for compatibility
  - [ ] Test with XLM and Stellar assets
  - [ ] Deploy to Stellar mainnet

### [ ] Days 6-7: Extend Mock Relayer
  - [ ] Add Stellar support to their relayer
    - [ ] Extend MockRelayer class
    - [ ] Handle Stellar as destination
    - [ ] Handle Stellar as source
    - [ ] Implement StellarMonitor
  - [ ] Integrate with Stellar contracts
    - [ ] Deploy escrow calls
    - [ ] Fund escrow calls
    - [ ] Event monitoring
  - [ ] Test extended relayer

### [ ] Days 8-9: Integration
  - [ ] Create Stellar order format
    - [ ] Extend CrossChainOrder
    - [ ] Add Stellar chain ID
    - [ ] Map token addresses
    - [ ] Whitelist our resolver
  - [ ] Address translation layer
    - [ ] EVM to Stellar mapping
    - [ ] Stellar to EVM mapping
    - [ ] Deterministic generation
  - [ ] Token mapping system
    - [ ] USDC on both chains
    - [ ] XLM native handling

### [ ] Days 10-11: Testing
  - [ ] Unit tests for Stellar components
  - [ ] Integration tests for full flow
  - [ ] Mainnet deployment and testing
    - [ ] Deploy with small amounts
    - [ ] Test USDC → XLM swap
    - [ ] Test XLM → USDC swap
    - [ ] Verify gas costs
  - [ ] Fix any issues found

### [ ] Days 12-13: UI Updates
  - [ ] Add Stellar chain option
  - [ ] Integrate Freighter wallet
  - [ ] Update order creation flow
    - [ ] User generates secret
    - [ ] Create order locally
    - [ ] Whitelist our resolver
  - [ ] Show swap progress
  - [ ] Handle completion

### [ ] Day 14: Demo Preparation
  - [ ] Create demo script
  - [ ] Test full flow multiple times
  - [ ] Prepare presentation
    - [ ] Show 1inch example working
    - [ ] Explain Stellar extension
    - [ ] Live demo on mainnet
    - [ ] Highlight innovation
  - [ ] Record backup video

## Hackathon Implementation Approach

### Extension Strategy
```typescript
// 1. Extend their existing classes
class ExtendedRelayer extends MockRelayer {
  private stellarMonitor: StellarMonitor;
  
  async handleOrder(order: CrossChainOrder) {
    if (order.dstChainId === STELLAR_CHAIN_ID) {
      return this.handleStellarDestination(order);
    }
    return super.handleOrder(order);
  }
}

// 2. Add Stellar-specific handling
class StellarMonitor {
  async deployEscrow(params: EscrowParams) {
    // Call Stellar resolver contract
  }
  
  async watchForEvents(contractId: string) {
    // Monitor Soroban events
  }
}
```

### Key Hackathon Deliverables
1. **Working Demo**: Ethereum ↔ Stellar swap
2. **Code Extension**: Their example + Stellar
3. **Mainnet Proof**: Real transactions
4. **Innovation**: First non-EVM integration
5. **Documentation**: Clear explanation

### Demo Requirements
1. **Use their infrastructure**: Mock relayer + example
2. **Local order creation**: No API needed
3. **Our resolver whitelisted**: In mock system
4. **Stellar contracts deployed**: On mainnet
5. **Successful swap shown**: Live or recorded

## Files to Create for Hackathon

### New Stellar Components
```
stellar-fusion/resolver/
├── Cargo.toml
├── src/
│   ├── lib.rs          # Resolver contract
│   ├── types.rs        # Stellar types
│   └── test.rs         # Contract tests

src/services/stellar/
├── StellarMonitor.ts   # Event monitoring
├── StellarResolver.ts  # Resolver interface
└── AddressMapper.ts    # Address translation

src/relayer/
├── ExtendedRelayer.ts  # Extended mock relayer
└── StellarHandler.ts   # Stellar-specific logic
```

### Modified Files (from their example)
```
- package.json                    # Add Stellar SDK
- src/relayer/MockRelayer.ts     # Extend for Stellar
- src/types/chains.ts            # Add Stellar chain
- tests/integration.test.ts      # Add Stellar tests
```

## Hackathon Tech Stack

### Their Example (Base)
```json
{
  "@1inch/fusion-sdk": "^3.0.0",
  "@1inch/limit-order-protocol": "^4.0.0",
  "ethers": "^6.9.0",
  "hardhat": "^2.19.0"
}
```

### Our Additions (Stellar)
```json
{
  "stellar-sdk": "^11.0.0",
  "@stellar/freighter-api": "^1.7.0"
}
```

```toml
[dependencies]
soroban-sdk = "20.0.0"
```

## Quick Start for Hackathon

### Day 1: Get Started
```bash
# Clone their example
git clone https://github.com/1inch/cross-chain-resolver-example
cd cross-chain-resolver-example
npm install
npm test

# Understand their flow
# Study MockRelayer.ts
# Review resolver contracts
```

### Day 2-7: Build Stellar Extension
1. **Create Stellar resolver contract**
2. **Extend their MockRelayer**
3. **Add StellarMonitor class**
4. **Implement address mapping**

### Day 8-14: Integration & Demo
1. **Test full flow locally**
2. **Deploy to mainnet**
3. **Create compelling demo**
4. **Prepare presentation**

## Hackathon Success Factors

### What Makes Us Win
1. **First non-EVM integration** - Stellar innovation
2. **Working mainnet demo** - Not just testnet
3. **Clean extension** - Building on their example
4. **Professional presentation** - Clear value prop
5. **Technical excellence** - Well-architected code

### Key Messages
1. **"We extended 1inch to Stellar"** - Clear achievement
2. **"It works on mainnet today"** - Tangible proof
3. **"Path to production is clear"** - Future potential
4. **"Non-EVM chains are viable"** - Market expansion

### Demo Script
1. Show their example working (ETH ↔ BSC)
2. Explain our Stellar extension
3. Execute live swap (ETH ↔ XLM)
4. Show on-chain proof
5. Discuss production path