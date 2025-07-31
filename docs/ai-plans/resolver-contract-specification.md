# Resolver Contract Specification (Hackathon Focus)

## Overview

This document specifies how to extend the 1inch cross-chain resolver example to support Stellar for the hackathon. We'll build on their existing patterns rather than creating from scratch.

## Hackathon Approach

### Starting Point

1. **Their Example** - Working Ethereum ↔ BSC implementation
2. **Our Extension** - Add Stellar as new chain
3. **Their Infrastructure** - Use mock relayer with our resolver
4. **Focus** - Demo working swaps, not production perfection

### Key Strategy

- **Extend, don't replace** - Keep their architecture
- **Minimal changes** - Add Stellar-specific parts only
- **Use their patterns** - Follow existing code style
- **Demo priority** - Working > perfect

## Ethereum Resolver Contract

### Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOrderMixin} from "@1inch/limit-order-protocol/contracts/interfaces/IOrderMixin.sol";
import {TakerTraits} from "@1inch/limit-order-protocol/contracts/libraries/TakerTraitsLib.sol";
import {IEscrowFactory} from "./interfaces/IEscrowFactory.sol";
import {IBaseEscrow} from "./interfaces/IBaseEscrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";

contract Resolver is Ownable {
    IEscrowFactory private immutable _FACTORY;
    IOrderMixin private immutable _LOP;

    constructor(
        IEscrowFactory factory, 
        IOrderMixin lop, 
        address initialOwner
    ) Ownable(initialOwner) {
        _FACTORY = factory;
        _LOP = lop;
    }

    receive() external payable {}
}
```

### Core Functions

#### 1. Deploy Source Escrow (Atomic with Order Fill)

```solidity
function deploySrc(
    IBaseEscrow.Immutables calldata immutables,
    IOrderMixin.Order calldata order,
    bytes32 r,
    bytes32 vs,
    uint256 amount,
    TakerTraits takerTraits,
    bytes calldata args
) external payable onlyOwner {
    // Calculate future escrow address
    IBaseEscrow.Immutables memory immutablesMem = immutables;
    immutablesMem.timelocks = TimelocksLib.setDeployedAt(
        immutables.timelocks, 
        block.timestamp
    );
    address computed = _FACTORY.addressOfEscrowSrc(immutablesMem);
    
    // Send safety deposit to future escrow address
    (bool success,) = address(computed).call{value: immutablesMem.safetyDeposit}("");
    if (!success) revert IBaseEscrow.NativeTokenSendingFailure();
    
    // Set target for order fill (enables atomic deployment)
    takerTraits = TakerTraits.wrap(TakerTraits.unwrap(takerTraits) | uint256(1 << 251));
    bytes memory argsMem = abi.encodePacked(computed, args);
    
    // Fill order through LOP (triggers escrow deployment)
    _LOP.fillOrderArgs(order, r, vs, amount, takerTraits, argsMem);
}
```

**Critical Points**:
- Safety deposit sent BEFORE order fill
- Escrow address calculated deterministically
- Order fill triggers escrow deployment atomically
- Resolver pays gas and provides capital

#### 2. Deploy Destination Escrow

```solidity
function deployDst(
    IBaseEscrow.Immutables calldata dstImmutables, 
    uint256 srcCancellationTimestamp
) external payable onlyOwner {
    _FACTORY.createDstEscrow{value: msg.value}(
        dstImmutables, 
        srcCancellationTimestamp
    );
}
```

**Key Points**:
- Called after source escrow creation
- Includes safety deposit for destination
- Uses source cancellation timestamp

#### 3. Withdraw (Using User's Revealed Secret)

```solidity
function withdraw(
    IEscrow escrow, 
    bytes32 secret, 
    IBaseEscrow.Immutables calldata immutables
) external {
    escrow.withdraw(secret, immutables);
}
```

**Important**:
- Anyone can call (not just owner)
- Uses secret revealed by user
- Resolver never knows secret in advance

#### 4. Cancel Escrow

```solidity
function cancel(
    IEscrow escrow, 
    IBaseEscrow.Immutables calldata immutables
) external {
    escrow.cancel(immutables);
}
```

### Security Considerations

1. **Access Control**: Only owner can fill orders and deploy escrows
2. **Reentrancy**: Protect against recursive calls
3. **Fund Management**: Handle native token transfers safely
4. **Input Validation**: Verify all parameters

## Stellar Resolver Contract (Soroban)

### Contract Structure

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env};

pub struct Resolver;

#[contract]
pub struct ResolverContract;

#[contractimpl]
impl ResolverContract {
    pub fn initialize(
        env: Env,
        owner: Address,
        htlc_contract: Address,
    ) {
        // Set owner and HTLC contract reference
    }
}
```

### Core Functions

#### 1. Fill Order (Stellar Adaptation)

```rust
pub fn fill_order(
    env: Env,
    order: Order,
    immutables: Immutables,
    amount: i128,
) -> Result<Address, Error> {
    // Verify caller is owner
    let owner: Address = env.storage().instance().get(&OWNER).unwrap();
    owner.require_auth();
    
    // Since Stellar doesn't have LOP, directly deploy escrow
    let escrow = deploy_escrow(&env, &immutables)?;
    
    // Transfer tokens from resolver to escrow
    transfer_tokens(&env, &immutables.token, amount, &escrow)?;
    
    Ok(escrow)
}
```

#### 2. Deploy Destination Escrow

```rust
pub fn deploy_destination(
    env: Env,
    immutables: Immutables,
    src_cancel_time: u64,
) -> Result<Address, Error> {
    let owner: Address = env.storage().instance().get(&OWNER).unwrap();
    owner.require_auth();
    
    // Deploy matching escrow on Stellar
    let escrow = htlc_contract.deploy_escrow(&immutables);
    
    // Fund escrow
    transfer_tokens(&env, &immutables.token, immutables.amount, &escrow)?;
    
    Ok(escrow)
}
```

### Stellar-Specific Considerations

1. **No LOP**: Implement order matching differently
2. **Asset Handling**: Support both XLM and Stellar assets
3. **Address Format**: Handle 32-byte Stellar addresses
4. **Auth Model**: Use Stellar's authorization system

## Optional Monitoring Service

### Purpose

The monitoring service is optional and helps resolvers:
- Find profitable orders
- Trigger contract functions
- Monitor secret reveals
- Track performance

### Architecture

```typescript
interface ResolverMonitor {
    // Connect to 1inch order stream
    watchOrders(): AsyncGenerator<CrossChainOrder>;
    
    // Evaluate profitability
    calculateProfit(order: CrossChainOrder): ProfitAnalysis;
    
    // Trigger resolver contract
    fillOrder(order: CrossChainOrder): Promise<TransactionHash>;
    
    // Monitor for user's secret reveal
    watchSecretReveals(): AsyncGenerator<SecretRevealEvent>;
    
    // Use revealed secret to withdraw
    withdrawWithSecret(escrow: Address, secret: BytesN<32>): Promise<void>;
}
```

### Key Functions

1. **Order Monitoring**: Watch 1inch order broadcasts
2. **Profit Calculation**: Factor in gas, slippage, capital cost
3. **Contract Interaction**: Call resolver contract functions
4. **Secret Monitoring**: Watch for user's secret reveal (NOT generate)

## Cross-Chain Flow

### Correct Flow Sequence

1. **User Creates Order**
   - User generates secret: `secret = randomBytes(32)`
   - User computes hashlock: `hashlock = keccak256(secret)`
   - User creates order with hashlock
   - User signs and broadcasts order

2. **Resolver Fills Order**
   - Resolver evaluates profitability
   - Resolver calls `deploySrc()` on contract
   - Contract sends safety deposit
   - Contract fills order via LOP
   - Source escrow deployed atomically

3. **Resolver Deploys Destination**
   - Resolver calls `deployDst()` on destination chain
   - Destination escrow created
   - Resolver funds destination escrow

4. **User Reveals Secret**
   - User verifies destination escrow
   - User calls `withdraw()` with secret
   - Secret revealed in transaction

5. **Resolver Completes Swap**
   - Resolver detects secret reveal event
   - Resolver calls `withdraw()` on source
   - Both parties receive funds

## Hackathon Implementation Plan

### Day 1-2: Understand Their Code
- [ ] Get example running locally
- [ ] Trace Ethereum ↔ BSC flow
- [ ] Study MockRelayer class
- [ ] Identify extension points
- [ ] Plan Stellar additions

### Day 3-5: Stellar Resolver Contract
- [ ] Create minimal Soroban contract
- [ ] Match their function signatures
- [ ] Deploy to Stellar mainnet
- [ ] Test basic operations

### Day 6-7: Extend Mock Relayer
```typescript
// Their code + our extension
class ExtendedRelayer extends MockRelayer {
  private stellarMonitor: StellarMonitor;
  
  async handleOrder(order: CrossChainOrder) {
    if (order.dstChainId === STELLAR_CHAIN_ID) {
      return this.handleStellarDestination(order);
    }
    return super.handleOrder(order);
  }
}
```

### Day 8-11: Integration & Testing
- [ ] Connect all components
- [ ] Test full flow locally
- [ ] Deploy to mainnet
- [ ] Execute test swaps
- [ ] Fix any issues

### Day 12-14: Demo Polish
- [ ] Clean up code
- [ ] Update UI for demo
- [ ] Prepare presentation
- [ ] Record backup video

## Hackathon Success Factors

### What Matters Most

1. ✅ **Working Demo** - Show successful swap
2. ✅ **Clean Extension** - Build on their code
3. ✅ **Mainnet Proof** - Real transactions
4. ✅ **Clear Story** - Explain innovation
5. ✅ **Time Management** - Ship don't perfect

### Demo Script

```bash
# 1. Show their example working
./demo-eth-bsc-swap.sh

# 2. Show our Stellar extension
./demo-eth-stellar-swap.sh

# 3. Explain the innovation
"First non-EVM chain integrated with 1inch Fusion+"
"Opens path for all non-EVM chains"
"Built on proven 1inch patterns"
```

### Quick Start Commands

```bash
# Day 1: Get started
git clone https://github.com/1inch/cross-chain-resolver-example
cd cross-chain-resolver-example
npm install && npm test

# Day 3: Deploy Stellar
cd stellar-fusion/resolver
cargo build --release
stellar contract deploy --network mainnet

# Day 8: Test integration
npm run test:stellar

# Day 14: Run demo
./run-hackathon-demo.sh
```

---

**Hackathon Focus**: Extend their example to support Stellar. Don't rebuild everything - just add what's needed for non-EVM support. Time is limited, so focus on a working demo over perfect architecture.