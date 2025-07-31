# Resolver Smart Contract Plan

## ⚠️ ARCHITECTURAL REVISION REQUIRED

Based on the 1inch cross-chain resolver example, our current implementation has fundamental architectural issues. This document has been updated to reflect the correct architecture.

## Objective and Success Criteria

### Objective
Build a resolver system that consists of:
1. **Smart Contracts** on each chain that fill orders through the 1inch Limit Order Protocol
2. **Optional Service** for monitoring profitable orders and triggering contract actions

### Success Criteria
- [ ] Resolver smart contracts deployed on Ethereum and Stellar
- [ ] Integration with 1inch Limit Order Protocol for order filling
- [ ] Atomic escrow deployment with order filling
- [ ] User-controlled secret management (NOT resolver-controlled)
- [ ] Cross-chain coordination without generating secrets
- [ ] Profitable order detection and execution

## Current Implementation Issues
❌ **INCORRECT** - Current implementation misunderstands the resolver role:
- Treats resolver as only an event-monitoring service
- Resolver generates and controls secrets (should be user-controlled)
- No integration with Limit Order Protocol
- Escrows deployed reactively instead of atomically

## Correct Architecture

### 1. Resolver Smart Contracts (Primary Component)

#### Ethereum Resolver Contract
```solidity
contract Resolver is Ownable {
    IEscrowFactory private immutable _FACTORY;
    IOrderMixin private immutable _LOP;
    
    // Fill order through LOP and deploy escrow atomically
    function deploySrc(
        IBaseEscrow.Immutables calldata immutables,
        IOrderMixin.Order calldata order,
        bytes32 r,
        bytes32 vs,
        uint256 amount,
        TakerTraits takerTraits
    ) external payable onlyOwner {
        // 1. Send safety deposit to escrow address
        // 2. Fill order through Limit Order Protocol
        // Order filling triggers escrow deployment
    }
    
    // Deploy destination escrow
    function deployDst(
        IBaseEscrow.Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) external payable onlyOwner {
        _FACTORY.createDstEscrow{value: msg.value}(dstImmutables, srcCancellationTimestamp);
    }
    
    // User or resolver can withdraw with secret
    function withdraw(IEscrow escrow, bytes32 secret) external;
    
    // Cancel escrow after timelock
    function cancel(IEscrow escrow) external;
}
```

#### Stellar Resolver Contract (To Be Implemented)
- Similar functionality adapted for Stellar/Soroban
- Must interact with Stellar HTLC contracts
- Handle XLM and Stellar asset transfers

### 2. Optional Resolver Service (Secondary Component)

The service monitors profitable orders and triggers smart contract actions:

```typescript
interface ResolverService {
  // Monitor 1inch order broadcasts
  watchOrders(): AsyncGenerator<FusionOrder>;
  
  // Calculate profitability
  evaluateOrder(order: FusionOrder): ProfitAnalysis;
  
  // Trigger smart contract to fill order
  fillOrder(order: FusionOrder): Promise<TxHash>;
  
  // Monitor for secret reveals (NOT generate secrets)
  watchSecretReveals(): AsyncGenerator<SecretReveal>;
}
```

## Revised Tasks

### [ ] Main Task 1: Resolver Smart Contracts
  - [ ] Subtask 1.1: Ethereum Resolver Contract
    - [ ] Create Solidity contract inheriting from Ownable
    - [ ] Add immutable references to EscrowFactory and LOP
    - [ ] Implement deploySrc function with atomic order filling
    - [ ] Implement deployDst function for destination escrow
    - [ ] Add withdraw and cancel functions
    - [ ] Test with 1inch mainnet fork
  - [ ] Subtask 1.2: Stellar Resolver Contract
    - [ ] Create Soroban contract with similar functionality
    - [ ] Adapt for Stellar's transaction model
    - [ ] Handle XLM and Stellar asset transfers
    - [ ] Implement cross-contract calls to HTLC
    - [ ] Test on Stellar testnet
  - [ ] Subtask 1.3: Contract Security
    - [ ] Add access control (onlyOwner modifiers)
    - [ ] Implement reentrancy guards
    - [ ] Add input validation
    - [ ] Handle edge cases and failures

### [ ] Main Task 2: Limit Order Protocol Integration
  - [ ] Subtask 2.1: Order Filling Logic
    - [ ] Integrate with IOrderMixin interface
    - [ ] Implement fillOrderArgs with proper parameters
    - [ ] Handle TakerTraits encoding
    - [ ] Set up atomic escrow deployment
  - [ ] Subtask 2.2: Order Validation
    - [ ] Verify order signatures
    - [ ] Check order parameters
    - [ ] Validate auction timing
    - [ ] Ensure resolver is whitelisted
  - [ ] Subtask 2.3: Safety Deposit Handling
    - [ ] Calculate required safety deposits
    - [ ] Send deposits atomically with order fill
    - [ ] Handle deposit returns
    - [ ] Track deposit states

### [ ] Main Task 3: Cross-Chain Coordination (No Secret Generation!)
  - [ ] Subtask 3.1: Order Monitoring
    - [ ] Monitor 1inch order broadcasts
    - [ ] Filter for profitable opportunities
    - [ ] Check resolver whitelist status
    - [ ] Calculate Dutch auction prices
  - [ ] Subtask 3.2: Escrow Deployment
    - [ ] Deploy source escrow via order fill
    - [ ] Calculate destination parameters
    - [ ] Deploy destination escrow
    - [ ] Track deployment status
  - [ ] Subtask 3.3: Secret Monitoring (NOT Generation)
    - [ ] Watch for user's secret reveal
    - [ ] Detect SecretRevealed events
    - [ ] Use revealed secret for withdrawal
    - [ ] Handle withdrawal timing

### [ ] Main Task 4: Optional Monitoring Service
  - [ ] Subtask 4.1: Order Monitoring Service
    - [ ] Connect to 1inch order broadcast system
    - [ ] Implement WebSocket connection
    - [ ] Parse Fusion+ order format
    - [ ] Filter for supported chains
  - [ ] Subtask 4.2: Profitability Analysis
    - [ ] Calculate swap profitability
    - [ ] Factor in gas costs
    - [ ] Consider slippage and fees
    - [ ] Implement bidding strategy
  - [ ] Subtask 4.3: Contract Interaction
    - [ ] Trigger resolver contract functions
    - [ ] Monitor transaction status
    - [ ] Handle failures and retries
    - [ ] Track performance metrics

### [ ] Main Task 5: Correct Flow Implementation
  - [ ] Subtask 5.1: User Order Creation
    - [ ] User generates secret and hashlock
    - [ ] User creates order with 1inch SDK
    - [ ] Order includes user's hashlock
    - [ ] Order broadcast to resolvers
  - [ ] Subtask 5.2: Resolver Order Filling
    - [ ] Resolver evaluates profitability
    - [ ] Resolver fills order via smart contract
    - [ ] Source escrow deployed atomically
    - [ ] Resolver deploys destination escrow
  - [ ] Subtask 5.3: Secret Reveal Flow
    - [ ] User validates destination escrow
    - [ ] User reveals secret to withdraw
    - [ ] Resolver detects secret reveal
    - [ ] Resolver withdraws using revealed secret

## Technical Considerations

### Smart Contract Architecture
1. **Atomic Operations**: Order fill and escrow deploy in single transaction
2. **Access Control**: Only resolver owner can fill orders
3. **Gas Optimization**: Minimize storage operations
4. **Upgradability**: Consider proxy pattern for updates
5. **Cross-chain Addressing**: Deterministic address calculation

### Integration Requirements
1. **1inch LOP**: Must implement IOrderMixin interface
2. **EscrowFactory**: Interact with factory for deployments
3. **TakerTraits**: Proper encoding for order parameters
4. **Signature Verification**: Validate order signatures
5. **Whitelist Checking**: Ensure resolver is authorized

### Security Considerations
1. **No Secret Generation**: Users control their secrets
2. **Front-running Protection**: Use commit-reveal where needed
3. **Reentrancy Guards**: Protect against recursive calls
4. **Input Validation**: Verify all external inputs
5. **Access Control**: Strict permission management

### Cross-Chain Challenges
1. **Address Format**: Handle 20-byte (EVM) vs 32-byte (Stellar)
2. **Asset Mapping**: Map between chain-specific tokens
3. **Time Synchronization**: Handle chain time differences
4. **Transaction Models**: Adapt between different chains
5. **Event Formats**: Normalize cross-chain events

## Files That Need Major Changes

### Smart Contracts (NEW)
- `contracts/ethereum/` - Ethereum contracts
  - `Resolver.sol` - Main resolver contract
  - `interfaces/IResolver.sol` - Resolver interface
  - `test/Resolver.test.ts` - Contract tests

- `stellar-fusion/resolver/` - Stellar contracts
  - `resolver.rs` - Soroban resolver contract
  - `lib.rs` - Contract entry point
  - `test.rs` - Contract tests

### Service Files (REWRITE NEEDED)
- `src/services/resolver/` - Current implementation is incorrect
  - `ResolverService.ts` - Needs complete rewrite
  - `SwapOrchestrator.ts` - Remove secret generation
  - `SecretManager.ts` - Change to secret monitoring only
  - ❌ Remove all secret generation logic
  - ❌ Remove event-based escrow deployment
  - ✅ Add order monitoring
  - ✅ Add contract interaction

### Integration Files (UPDATE)
- `src/services/1inch/` - 1inch integration
  - `OrderMonitor.ts` - Monitor order broadcasts
  - `LimitOrderProtocol.ts` - LOP integration
  - `FusionSDK.ts` - Order parsing

### Configuration (UPDATE)
- `.env.example` - Add resolver contract addresses
- `config/chains.ts` - Add resolver configurations
- `hardhat.config.ts` - Add resolver deployment

## Dependencies

### Smart Contract Dependencies
```json
{
  "@1inch/limit-order-protocol": "^4.0.0",
  "@1inch/fusion-sdk": "^3.0.0",
  "@openzeppelin/contracts": "^4.9.0",
  "hardhat": "^2.19.0",
  "@nomicfoundation/hardhat-ethers": "^3.0.0"
}
```

### Service Dependencies (if implementing optional service)
```json
{
  "ethers": "^6.9.0",
  "stellar-sdk": "^11.0.0",
  "@1inch/fusion-sdk": "^3.0.0",
  "ws": "^8.15.0",
  "winston": "^3.11.0"
}
```

### Stellar Dependencies
```toml
[dependencies]
soroban-sdk = "20.0.0"
```

## Critical Differences from Current Implementation

### ❌ What We Got Wrong
1. **Resolver generates secrets** - Users must control secrets
2. **Event-driven architecture** - Should be order-driven
3. **Reactive escrow deployment** - Must be atomic with order fill
4. **No LOP integration** - Essential for 1inch compatibility
5. **Service-only approach** - Smart contracts are primary

### ✅ Correct Approach
1. **Smart contract resolver** - Fills orders on-chain
2. **User controls secrets** - Resolver never generates
3. **Atomic operations** - Order fill triggers escrow
4. **LOP integration** - Use 1inch infrastructure
5. **Optional service** - Only for monitoring/triggering

## Next Steps

1. **Stop current development** on incorrect service architecture
2. **Design resolver smart contracts** for both chains
3. **Study 1inch example** more thoroughly
4. **Update all documentation** to reflect correct architecture
5. **Plan migration** from current incorrect implementation 