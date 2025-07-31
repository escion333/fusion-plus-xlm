# Stellar Fusion+ DeFi Integration Portal - Project Specification

## Project Overview

### Vision (Hackathon Focus)
Demonstrate Stellar integration with 1inch Fusion+ by extending their cross-chain resolver example to support non-EVM chains.

### Target Bounty
- **Primary**: 1inch Priority Fusion+ (Stellar) - $12,000 (1st place)
- **Secondary**: Judges Pick - $1,000 bonus
- **Total Potential**: $13,000

### Hackathon Strategy
1. **Extend their example** - Not rebuild from scratch
2. **Use their mock relayer** - With our resolver whitelisted
3. **Focus on Stellar innovation** - First non-EVM integration
4. **Mainnet demo** - Show real working swaps

## Technical Architecture

### Core Components

#### 1. Stellar Escrow Contract (Soroban)
- **Language**: Rust (Soroban SDK)
- **Key Features**:
  - Hash Time Lock Contract (HTLC) implementation
  - Support for XLM and Stellar assets
  - Deterministic address generation matching 1inch protocol
  - 7-stage timelock management (bit-packed)
  - Safety deposit mechanism
  - Event emission for resolver monitoring

**Implementation Notes**:
- Reference 1inch Solana implementation (also Rust-based)
- Use Soroban's native storage for timelocks
- Implement custom errors matching 1inch protocol
- Support cross-contract calls for token transfers

#### 2. EVM Integration
- **Network**: Ethereum Mainnet
- **Contracts**: 
  - Utilize existing 1inch EscrowFactory
  - Deploy resolver contract
  - Integration with Limit Order Protocol

#### 3. Resolver System (HACKATHON APPROACH)
- **Starting Point**: 1inch cross-chain resolver example
- **Our Addition**: Stellar extension

**Extend Their Components**:
- **MockRelayer**: Add Stellar chain support
- **Resolver Contracts**: Already exist for Ethereum
- **Stellar Resolver**: New Soroban contract
- **Integration**: Minimal changes to their code

**Hackathon Implementation**:
- Use their existing infrastructure
- Add Stellar as new destination/source
- Keep their architecture patterns
- Focus on working demo, not production

#### 4. Frontend Application
- **Framework**: Next.js 14 with TypeScript
- **UI Library**: Tailwind CSS + Shadcn/ui
- **Features**:
  - Cross-chain swap interface
  - Real-time transaction tracking
  - Wallet integration (MetaMask + Freighter)

### Hackathon Requirements

#### Must Have (for winning)
1. **Working Demo**: Show Ethereum ↔ Stellar swap
2. **Their Infrastructure**: Use mock relayer + example
3. **Mainnet Proof**: Real transactions, not testnet
4. **Clean Extension**: Build on their patterns

#### Nice to Have (if time permits)
1. **Beautiful UI**: Already mostly done
2. **Partial Fills**: Can demo concept
3. **Multiple Swaps**: Show reliability
4. **Documentation**: Clear explanation

## Implementation Details

### Escrow Immutables Structure
```rust
// Soroban version
#[contracttype]
pub struct Immutables {
    pub order_hash: BytesN<32>,
    pub hashlock: BytesN<32>,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub timelocks: u64, // bit-packed
}
```

### Timelock Stages
```
Source Chain:
1. SrcWithdrawal (finality period)
2. SrcPublicWithdrawal
3. SrcCancellation
4. SrcPublicCancellation

Destination Chain:
5. DstWithdrawal (finality period)
6. DstPublicWithdrawal
7. DstCancellation
```

### Stellar-Specific Adaptations
1. **Address Format**: 
   - EVM: 20-byte addresses (0x...)
   - Stellar: 32-byte public keys (G...)
   - Use deterministic mapping for cross-chain addressing

2. **Asset Handling**: 
   - XLM: Native asset, no issuer required
   - USDC: Issued asset with issuer address
   - Support Stellar's trustline model

3. **Transaction Model**:
   - Stellar uses sequence numbers (not nonces)
   - Operations bundled in transactions
   - Memo field for order hash storage

4. **Storage Model**:
   - Soroban persistent storage for escrow state
   - Temporary storage for intermediate data
   - Instance storage for contract metadata

### Soroban HTLC Implementation Details
```rust
// Key functions to implement
pub trait CrossChainEscrow {
    // Deploy new escrow with deterministic address
    fn deploy(e: Env, immutables: Immutables) -> Address;
    
    // Withdraw funds with secret reveal
    fn withdraw(e: Env, secret: BytesN<32>, unwrap_native: bool);
    
    // Cancel and return funds
    fn cancel(e: Env);
    
    // Public withdrawal after timelock
    fn public_withdraw(e: Env, secret: BytesN<32>);
    
    // Rescue funds after final timelock
    fn rescue_funds(e: Env, token: Address, amount: i128, to: Address);
}
```

### Partial Fills Implementation
- Generate N+1 secrets for N parts
- Build Merkle tree with `keccak256(index, hashedSecret)` leaves
- Index calculation: `(orderMakingAmount - remainingMakingAmount + makingAmount - 1) * partsAmount / orderMakingAmount`
- Store Merkle root in Soroban contract

### Correct Resolver Architecture

#### Smart Contract (Primary)
```solidity
contract Resolver is Ownable {
    IEscrowFactory private immutable _FACTORY;
    IOrderMixin private immutable _LOP;
    
    // Fill order and deploy escrow atomically
    function deploySrc(
        IBaseEscrow.Immutables calldata immutables,
        IOrderMixin.Order calldata order,
        bytes32 r,
        bytes32 vs,
        uint256 amount,
        TakerTraits takerTraits
    ) external payable onlyOwner;
    
    // Deploy destination escrow
    function deployDst(
        IBaseEscrow.Immutables calldata dstImmutables
    ) external payable onlyOwner;
    
    // Withdraw using user-revealed secret
    function withdraw(IEscrow escrow, bytes32 secret) external;
}
```

#### Service (Optional)
```typescript
interface ResolverService {
  // Monitor profitable orders (NOT escrows)
  watchOrders(): AsyncGenerator<FusionOrder>;
  
  // Trigger contract to fill order
  fillOrder(order: FusionOrder): Promise<TxHash>;
  
  // Watch for user's secret reveal
  watchSecretReveals(): AsyncGenerator<SecretReveal>;
}
```

### Hackathon Integration Approach
1. **Use Their Example**:
   - Start with working Ethereum ↔ BSC code
   - Study their MockRelayer implementation
   - Understand their resolver pattern
   - Extend, don't replace

2. **Add Stellar Support**:
   - Create Stellar resolver contract
   - Add StellarMonitor to relayer
   - Implement address mapping
   - Handle Stellar-specific logic

3. **Demo Requirements**:
   - Create orders locally (no API)
   - Whitelist our resolver in mock
   - Show successful swaps
   - Prove it works on mainnet

4. **Key Messages**:
   - "We extended 1inch to non-EVM"
   - "Stellar integration is working"
   - "Path to production is clear"
   - "First of many non-EVM chains"

## Progress & Hackathon Plan

### What We Have ✅
- **Stellar HTLC Contract**: Working, deployed, tested
- **Frontend**: Beautiful UI with wallets integrated
- **Basic Architecture**: Understanding of requirements
- **Documentation**: Comprehensive guides

### What We Need (Hackathon Focus) 🎯

#### Days 1-2: Foundation
- [ ] Clone 1inch resolver example
- [ ] Get Ethereum ↔ BSC working
- [ ] Study their architecture
- [ ] Plan Stellar extension

#### Days 3-5: Stellar Contracts
- [ ] Create Stellar resolver contract
- [ ] Deploy to mainnet
- [ ] Test basic operations
- [ ] Verify compatibility

#### Days 6-7: Relayer Extension
- [ ] Extend MockRelayer for Stellar
- [ ] Add StellarMonitor class
- [ ] Implement chain handlers
- [ ] Test integration

#### Days 8-9: Integration
- [ ] Connect all components
- [ ] Create order format
- [ ] Test full flow
- [ ] Fix issues

#### Days 10-11: Testing
- [ ] Mainnet deployment
- [ ] Execute test swaps
- [ ] Document results
- [ ] Prepare demo

#### Days 12-14: Polish
- [ ] Update UI for demo
- [ ] Create presentation
- [ ] Record backup video
- [ ] Final testing

## Hackathon Architecture

### Build Strategy
1. **Start with their example**
   - Don't reinvent the wheel
   - Use their proven patterns
   - Extend for Stellar support
   - Focus on what's unique

2. **Leverage existing work**
   - Our HTLC contracts work
   - Frontend mostly complete
   - Just need integration layer
   - Time to connect the dots

3. **Demo-first approach**
   - Working swap > perfect code
   - Mainnet proof > documentation
   - Visual impact > edge cases
   - Story matters most

## Winning Strategy

### Demo Requirements
- [ ] Show their example working (ETH ↔ BSC)
- [ ] Show our extension (ETH ↔ Stellar)
- [ ] Execute on mainnet live
- [ ] Explain the innovation clearly

### Key Messages
1. **"First non-EVM integration"**
2. **"Built on 1inch patterns"**
3. **"Working on mainnet today"**
4. **"Path to production clear"**

### Judging Criteria Focus
- **Innovation**: Stellar is non-EVM ✓
- **Technical**: Clean extension ✓
- **Practical**: Actually works ✓
- **Impact**: Opens new markets ✓

## Hackathon Execution

### Daily Goals
- **Day 1**: Get their example working
- **Day 3**: Stellar contracts deployed
- **Day 7**: Relayer extended
- **Day 10**: First successful swap
- **Day 14**: Polished demo ready

### Focus Areas
1. **Core functionality** over features
2. **Working demo** over perfect code
3. **Clear story** over complex details
4. **Mainnet proof** over documentation

## Resources & References

### Documentation
- [1inch Fusion+ Whitepaper](../1inch-docs/fusion+-whitepaper.md)
- [Cross-chain Swap Examples](../cross-chain-resolver-example/)
- [Stellar Soroban Docs](https://soroban.stellar.org/)
- [Soroban Examples](https://github.com/stellar/soroban-examples)

### Reference Implementations
- 1inch Solana implementation (Rust-based, similar patterns)
- Stellar atomic swap examples
- Soroban timelock contract examples

### Key Contracts
- EscrowFactory: `0x...` (varies by network)
- Limit Order Protocol: `0x...` (varies by network)
- Stellar USDC: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

### Support Channels
- 1inch Discord: Technical questions
- Stellar Discord: Soroban help
- Claude: Complex implementation assistance

## Hackathon Deliverables

1. **Working Demo**
   - Live Ethereum ↔ Stellar swap
   - Using 1inch infrastructure
   - On mainnet networks
   - Clear success metrics

2. **Code Extension**
   - Their example + Stellar
   - Minimal modifications
   - Clean integration
   - Well-documented

3. **Presentation**
   - Problem statement
   - Solution approach
   - Live demonstration
   - Future potential

4. **Proof Points**
   - Mainnet transactions
   - Working resolver
   - Successful swaps
   - Innovation clearly shown

---

**Last Updated**: December 2024
**Version**: 1.1
**Status**: In Development
