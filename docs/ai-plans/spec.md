# Stellar Fusion+ DeFi Integration Portal - Project Specification

## Project Overview

### Vision
Build a trustless cross-chain swap protocol enabling seamless value transfer between Ethereum and Stellar networks using 1inch Fusion+ architecture.

### Target Bounty
- **Primary**: 1inch Priority Fusion+ (Stellar) - $12,000 (1st place)
- **Secondary**: Judges Pick - $1,000 bonus
- **Total Potential**: $13,000

### Key Differentiators
1. First Stellar implementation of 1inch Fusion+
2. Beautiful UI with real-time swap visualization
3. Partial fills support using Merkle trees
4. Mainnet deployment demonstrating production readiness

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

#### 3. Resolver Service
- **Language**: TypeScript/Node.js
- **Responsibilities**:
  - Monitor source chain escrow creation
  - Deploy destination chain escrow
  - Manage secret distribution
  - Handle withdrawals and cancellations
  - Bridge Stellar RPC and Ethereum RPC

**Key Requirements**:
- Support both Horizon API and Soroban RPC
- Handle Stellar's different transaction model
- Manage XDR encoding/decoding for Stellar

#### 4. Frontend Application
- **Framework**: Next.js 14 with TypeScript
- **UI Library**: Tailwind CSS + Shadcn/ui
- **Features**:
  - Cross-chain swap interface
  - Real-time transaction tracking
  - Wallet integration (MetaMask + Freighter)

### Technical Requirements

#### Mandatory (from 1inch requirements)
1. **Hashlock/Timelock Functionality**: Preserve on both chains
2. **Bidirectional Swaps**: ETH→Stellar and Stellar→ETH
3. **On-chain Demo**: Mainnet or testnet execution
4. **Consistent Commit History**: Regular, meaningful commits

#### Stretch Goals (for higher scoring)
1. **UI**: Beautiful, intuitive interface ✓
2. **Partial Fills**: Merkle tree implementation ✓
3. **Relayer/Resolver**: Full implementation ✓
4. **Mainnet Deployment**: Both networks ✓

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

### Resolver Architecture
```typescript
interface StellarResolver {
  // Monitor Stellar escrow events
  watchStellarEscrows(): AsyncGenerator<EscrowEvent>;
  
  // Deploy corresponding EVM escrow
  deployEVMCounterpart(stellarEscrow: EscrowData): Promise<string>;
  
  // Submit secret to Stellar
  revealSecretOnStellar(secret: string, escrowId: string): Promise<void>;
  
  // Handle timelock expirations
  processTimelocks(): Promise<void>;
}
```

### 1inch Integration Requirements
1. **API Integration**:
   - 1inch Developer Portal API key required
   - Proxy implementation for CORS handling
   - Integration with Fusion SDK for order formatting

2. **Resolver Network**:
   - KYC/whitelisting required for production resolvers
   - Connection to 1inch order broadcast system
   - Integration with 1inch relayer for secret distribution

3. **Testing Strategy**:
   - No testnet available - use mainnet fork
   - Mock resolver system for demo purposes
   - Local simulation of cross-chain flow

4. **Order Flow**:
   - Maker creates order using 1inch Fusion SDK
   - Order broadcast through 1inch network
   - Resolvers compete in Dutch auction
   - Winner creates escrows on both chains

## Development Timeline (Actual Progress)

### Phase 1: Foundation ✅ COMPLETE
- [x] Set up Stellar development environment
- [x] Study 1inch Solana Rust implementation for patterns
- [x] Implement full Stellar HTLC contract in Soroban
- [x] Test all functionality with XLM and Stellar assets (14 tests passing)
- [x] Implement deterministic address calculation
- [x] Port timelock bit-packing logic to Rust (7-stage timelocks)
- [x] Add safety deposit mechanisms
- [x] Complete event emission system

### Phase 2: Integration ✅ COMPLETE
- [x] Build complete resolver service with Stellar SDK (24 tests passing)
- [x] Implement cross-chain monitoring for both chains
- [x] Handle Stellar's different transaction model
- [x] Add secret generation and management
- [x] Implement timelock tracking system
- [x] Create high-availability architecture
- [x] Add database persistence layer

### Phase 3: Frontend & UI ✅ COMPLETE
- [x] Build beautiful swap interface with Next.js 14
- [x] Implement MetaMask wallet integration
- [x] Implement Freighter wallet integration
- [x] Connect frontend to resolver API
- [x] Add real-time resolver status display
- [x] Create responsive design with Tailwind CSS
- [x] Add transaction state management

### Phase 4: Documentation & Testing ✅ COMPLETE
- [x] Create comprehensive integration guide
- [x] Write testnet deployment documentation
- [x] Test all builds thoroughly (all passing)
- [x] Create Docker infrastructure
- [x] Write API documentation
- [x] Update all project documentation

### Phase 5: 1inch Integration 🚧 IN PROGRESS
- [ ] Set up mainnet fork for local testing
- [ ] Implement 1inch API proxy for CORS handling
- [ ] Integrate 1inch Fusion SDK for order creation
- [ ] Create mock resolver system for demo
- [ ] Build local simulation of cross-chain flow
- [ ] Document production resolver integration

### Phase 6: Demo & Presentation 📋 PLANNED
- [ ] Create compelling demo video
- [ ] Show theoretical production flow
- [ ] Highlight Stellar innovation
- [ ] Prepare presentation materials

### Stretch Goals 📋 PLANNED
- [ ] Implement Merkle tree for partial fills
- [ ] Add real-time swap progress visualization
- [ ] Production resolver KYC/whitelisting
- [ ] Mainnet deployment preparation

## AI Collaboration Plan

### Claude Responsibilities
1. **Stellar Contract Development**
   - Soroban HTLC implementation
   - Deterministic addressing logic
   - Asset handling code

2. **Complex Algorithms**
   - Merkle tree implementation
   - Timelock bit-packing adaptation
   - Secret management logic

3. **Cross-Chain Logic**
   - Message formatting
   - Address translation
   - State synchronization

### Human Responsibilities
1. **Project Management**
   - Timeline tracking
   - Integration testing
   - Documentation

2. **User Experience**
   - UI/UX design
   - Frontend development
   - Demo preparation

3. **System Integration**
   - Resolver service setup
   - Deployment scripts
   - End-to-end testing

## Success Criteria

### Minimum Viable Product
- [ ] Basic ETH→Stellar→ETH swap working
- [ ] Testnet deployment functional
- [ ] Basic UI for swap execution
- [ ] Video demo of working swap

### Target Product
- [ ] Full bidirectional swaps
- [ ] Mainnet deployment
- [ ] Beautiful, intuitive UI
- [ ] Partial fills support
- [ ] DeFi integration portal
- [ ] Comprehensive documentation

### Winning Features
- [ ] <10 second cross-chain execution
- [ ] Live mainnet demo during presentation
- [ ] Multiple successful swaps demonstrated
- [ ] Clean, well-commented code
- [ ] Professional UI/UX

## Risk Mitigation

### Technical Risks
1. **Stellar Complexity**: Fallback to Polkadot if insurmountable
2. **Time Constraints**: Prioritize core swap over partial fills
3. **Mainnet Issues**: Keep testnet demo as backup

### Contingency Plans
- **Hours 0-24**: If Stellar setup fails, pivot immediately
- **Hours 24-48**: If integration fails, simplify to basic swap
- **Hours 48-72**: If UI time runs short, use simple interface
- **Final Hours**: Focus on demo quality over new features

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

## Deliverables

1. **Smart Contracts**
   - Stellar HTLC contract (Soroban)
   - Resolver contract (Solidity)

2. **Backend Services**
   - Resolver service
   - Event monitoring system

3. **Frontend Application**
   - Swap interface
   - Transaction tracker

4. **Documentation**
   - Technical README
   - API documentation
   - Demo video
   - Presentation slides

5. **Deployment**
   - Mainnet contracts
   - Hosted frontend
   - Public GitHub repo

---

**Last Updated**: December 2024
**Version**: 1.1
**Status**: In Development
