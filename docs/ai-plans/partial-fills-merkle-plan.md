# Partial Fills Merkle Tree Implementation Plan

## Objective and Success Criteria

### Objective
Implement partial fills functionality using Merkle trees to enable orders to be filled in multiple parts by different resolvers, increasing liquidity and execution efficiency.

### Success Criteria
- [ ] Support for splitting orders into N configurable parts
- [ ] Merkle tree generation with N+1 secrets for N parts
- [ ] On-chain Merkle proof verification in both Stellar and EVM contracts
- [ ] Resolver support for partial fill execution
- [ ] Index calculation matching 1inch specification
- [ ] Gas-efficient implementation
- [ ] Complete test coverage for all edge cases

## Tasks

### [ ] Main Task 1: Merkle Tree Core Implementation
  - [ ] Subtask 1.1: Create Merkle tree utility library
    - [ ] Implement keccak256 hashing for leaves
    - [ ] Build tree construction algorithm
    - [ ] Generate Merkle proofs for any leaf
  - [ ] Subtask 1.2: Secret generation system
    - [ ] Generate N+1 cryptographically secure secrets
    - [ ] Hash secrets appropriately
    - [ ] Create leaf nodes with format: keccak256(index || hashedSecret)
  - [ ] Subtask 1.3: Index calculation implementation
    - [ ] Port formula: `(orderMakingAmount - remainingMakingAmount + makingAmount - 1) * partsAmount / orderMakingAmount`
    - [ ] Handle edge cases and rounding
    - [ ] Create comprehensive test suite

### [ ] Main Task 2: Smart Contract Integration (EVM)
  - [ ] Subtask 2.1: Modify escrow contract for Merkle support
    - [ ] Add Merkle root to immutables structure
    - [ ] Implement proof verification function
    - [ ] Update withdrawal logic for partial amounts
  - [ ] Subtask 2.2: Gas optimization
    - [ ] Optimize proof verification algorithm
    - [ ] Use assembly for critical paths
    - [ ] Benchmark gas costs
  - [ ] Subtask 2.3: Security enhancements
    - [ ] Prevent double-spending of leaves
    - [ ] Add reentrancy guards
    - [ ] Implement proper access controls

### [ ] Main Task 3: Soroban Contract Integration
  - [ ] Subtask 3.1: Port Merkle verification to Rust
    - [ ] Implement keccak256 in Soroban environment
    - [ ] Create proof verification logic
    - [ ] Handle Stellar's different data types
  - [ ] Subtask 3.2: Storage optimization
    - [ ] Store used leaf indices efficiently
    - [ ] Minimize persistent storage usage
    - [ ] Implement cleanup mechanisms
  - [ ] Subtask 3.3: Cross-chain compatibility
    - [ ] Ensure hash functions match exactly
    - [ ] Test with EVM-generated proofs
    - [ ] Validate index calculations

### [ ] Main Task 4: Resolver Partial Fill Support
  - [ ] Subtask 4.1: Partial fill detection
    - [ ] Monitor orders with Merkle roots
    - [ ] Track remaining amounts
    - [ ] Calculate optimal fill sizes
  - [ ] Subtask 4.2: Secret management for partials
    - [ ] Store and retrieve specific secrets
    - [ ] Generate proofs for chosen indices
    - [ ] Handle secret reveal coordination
  - [ ] Subtask 4.3: Multi-resolver coordination
    - [ ] Implement locking mechanism
    - [ ] Handle concurrent fill attempts
    - [ ] Optimize for MEV resistance

### [ ] Main Task 5: Frontend Integration
  - [ ] Subtask 5.1: Order creation UI
    - [ ] Add partial fills toggle
    - [ ] Configure number of parts (N)
    - [ ] Show fee implications
  - [ ] Subtask 5.2: Visualization components
    - [ ] Display fill progress (X of N parts)
    - [ ] Show individual resolver fills
    - [ ] Animate partial completions
  - [ ] Subtask 5.3: Advanced features
    - [ ] Minimum fill size settings
    - [ ] Resolver whitelist/blacklist
    - [ ] Fill deadline configuration

### [ ] Main Task 6: Testing and Validation
  - [ ] Subtask 6.1: Unit tests
    - [ ] Merkle tree construction tests
    - [ ] Proof generation/verification tests
    - [ ] Index calculation edge cases
  - [ ] Subtask 6.2: Integration tests
    - [ ] Cross-chain partial fill scenarios
    - [ ] Multiple resolver competition
    - [ ] Failure and recovery cases
  - [ ] Subtask 6.3: Performance testing
    - [ ] Gas cost analysis
    - [ ] Proof generation benchmarks
    - [ ] Concurrent fill stress tests

## Technical Considerations

### Merkle Tree Design
1. **Leaf Format**: `keccak256(abi.encodePacked(index, hashedSecret))`
2. **Tree Structure**: Binary tree with sorted leaves
3. **Proof Format**: Array of sibling hashes from leaf to root
4. **Root Storage**: Stored in escrow immutables
5. **Security**: Each leaf can only be used once

### Index Calculation Details
```typescript
// Calculate which secret index to use for a partial fill
function calculateSecretIndex(
  orderMakingAmount: bigint,
  remainingMakingAmount: bigint,
  makingAmount: bigint,
  partsAmount: number
): number {
  return Number(
    ((orderMakingAmount - remainingMakingAmount + makingAmount - 1n) * 
     BigInt(partsAmount)) / orderMakingAmount
  );
}
```

### Gas Optimization Strategies
1. **Proof Verification**: Use optimized keccak256 implementation
2. **Storage Packing**: Pack used indices into bitmap
3. **Batch Operations**: Allow multiple partial fills in one transaction
4. **Caching**: Store intermediate hashes where beneficial

### Cross-Chain Considerations
1. **Hash Function Compatibility**: Ensure identical results on both chains
2. **Data Encoding**: Match encoding between Solidity and Rust
3. **Precision Handling**: Account for different number representations
4. **Event Formats**: Standardize events for resolver monitoring

## Files That Will Be Affected

### New Files to Create
- `src/lib/merkle/` - Merkle tree implementation
  - `MerkleTree.ts` - Core tree construction
  - `MerkleProof.ts` - Proof generation/verification
  - `SecretManager.ts` - Secret generation and management
  - `IndexCalculator.ts` - Partial fill index calculation

- `contracts/libraries/` - Smart contract libraries
  - `MerkleProof.sol` - On-chain verification
  - `PartialFillLib.sol` - Partial fill helpers

- `contracts/stellar/src/merkle/` - Soroban Merkle implementation
  - `merkle.rs` - Rust Merkle verification
  - `partial_fill.rs` - Partial fill logic

### Files to Modify
- `contracts/interfaces/IEscrow.sol` - Add Merkle root parameter
- `contracts/EscrowSrc.sol` - Implement partial withdrawal
- `contracts/EscrowDst.sol` - Implement partial withdrawal
- `src/services/resolver/resolver.ts` - Add partial fill logic
- `src/components/swap/SwapCard.tsx` - Add partial fill options

### Test Files
- `test/unit/MerkleTree.test.ts` - Merkle tree unit tests
- `test/integration/PartialFills.test.ts` - End-to-end tests
- `test/gas/MerkleGas.test.ts` - Gas optimization tests

## Dependencies

### JavaScript/TypeScript
```json
{
  "merkletreejs": "^0.3.11",
  "keccak256": "^1.0.6",
  "ethers": "^6.9.0"
}
```

### Solidity
```solidity
// OpenZeppelin Contracts
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
```

### Rust/Soroban
```toml
[dependencies]
tiny-keccak = { version = "2.0", features = ["keccak"] }
hex = "0.4"
```

## Risk Mitigation

1. **Complexity Risk**: Start with 2-part fills, expand to N parts after testing
2. **Gas Costs**: Implement off-chain proof generation, only verify on-chain
3. **Secret Exposure**: Use commit-reveal pattern if front-running is a concern
4. **Resolver Competition**: Implement fair ordering mechanism
5. **Cross-chain Sync**: Add retry logic for partial fill coordination 