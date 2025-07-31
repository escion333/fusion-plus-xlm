# Correct Cross-Chain Flow for 1inch Fusion+

This document describes the correct flow for cross-chain swaps using 1inch Fusion+ protocol, based on the official resolver example.

## Key Principles

1. **Users control secrets** - Resolvers never generate secrets
2. **Atomic operations** - Order fill and escrow deployment happen together
3. **Smart contract resolvers** - Not just monitoring services
4. **LOP integration** - Orders filled through Limit Order Protocol

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Cross-Chain Swap Flow                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. User Creates Order
   ┌─────────────┐
   │    User     │
   └──────┬──────┘
          │ Generates secret & hashlock
          │ Creates order with hashlock
          │ Signs order
          ▼
   ┌─────────────┐
   │ 1inch Order │
   │   System    │
   └──────┬──────┘
          │ Broadcasts order
          ▼

2. Resolver Fills Order
   ┌─────────────┐
   │  Resolver   │
   │  Contract   │
   └──────┬──────┘
          │ Evaluates profitability
          │ Calls deploySrc()
          ▼
   ┌─────────────┐
   │    LOP      │
   │ (fills order)│
   └──────┬──────┘
          │ Atomic with ▼
   ┌─────────────┐
   │   Source    │
   │   Escrow    │
   └─────────────┘

3. Resolver Deploys Destination
   ┌─────────────┐
   │  Resolver   │
   │  Contract   │
   └──────┬──────┘
          │ Calls deployDst()
          ▼
   ┌─────────────┐
   │ Destination │
   │   Escrow    │
   └─────────────┘

4. User Reveals Secret
   ┌─────────────┐
   │    User     │
   └──────┬──────┘
          │ Validates destination escrow
          │ Calls withdraw(secret)
          ▼
   ┌─────────────┐
   │ Destination │
   │  Withdrawn  │
   └──────┬──────┘
          │ Secret revealed in event
          ▼

5. Resolver Completes
   ┌─────────────┐
   │  Resolver   │
   └──────┬──────┘
          │ Detects SecretRevealed event
          │ Calls withdraw(secret)
          ▼
   ┌─────────────┐
   │   Source    │
   │  Withdrawn  │
   └─────────────┘
```

## Step-by-Step Implementation

### Step 1: User Creates Order (Frontend)

```typescript
// User generates secret client-side
const secret = randomBytes(32);
const hashlock = keccak256(secret);

// Create order with user's hashlock
const order = Sdk.CrossChainOrder.new(
  escrowFactory,
  {
    maker: userAddress,
    makingAmount: parseUnits('100', 6),
    takingAmount: parseUnits('99', 6),
    makerAsset: sourceToken,
    takerAsset: destToken,
  },
  {
    hashLock: Sdk.HashLock.forSingleFill(hashlock), // User's hashlock!
    timeLocks: Sdk.TimeLocks.new({...}),
    srcChainId,
    dstChainId,
    srcSafetyDeposit: parseEther('0.001'),
    dstSafetyDeposit: parseEther('0.001'),
  },
  // ... other parameters
);

// Sign and submit order
const signature = await wallet.signOrder(order);
await submitOrder(order, signature);

// Store secret securely (never send to resolver!)
secureStorage.set(order.orderHash, secret);
```

### Step 2: Resolver Fills Order (Smart Contract)

```solidity
function deploySrc(
    IBaseEscrow.Immutables calldata immutables,
    IOrderMixin.Order calldata order,
    bytes32 r,
    bytes32 vs,
    uint256 amount,
    TakerTraits takerTraits
) external payable onlyOwner {
    // Calculate escrow address
    address escrowAddress = _FACTORY.addressOfEscrowSrc(immutables);
    
    // Send safety deposit to future escrow
    (bool success,) = escrowAddress.call{value: immutables.safetyDeposit}("");
    require(success, "Safety deposit failed");
    
    // Fill order through LOP (triggers escrow deployment)
    _LOP.fillOrderArgs(order, r, vs, amount, takerTraits, args);
    
    // Escrow now exists and is funded
}
```

### Step 3: Resolver Deploys Destination (Smart Contract)

```solidity
function deployDst(
    IBaseEscrow.Immutables calldata dstImmutables,
    uint256 srcCancellationTimestamp
) external payable onlyOwner {
    // Deploy matching escrow on destination chain
    _FACTORY.createDstEscrow{value: msg.value}(
        dstImmutables,
        srcCancellationTimestamp
    );
    
    // Fund the escrow (resolver provides liquidity)
    IERC20(dstImmutables.token).transferFrom(
        address(this),
        escrowAddress,
        dstImmutables.amount
    );
}
```

### Step 4: User Reveals Secret (Frontend)

```typescript
// User verifies destination escrow is deployed and funded
const escrowState = await destinationEscrow.getState();
if (escrowState.funded && escrowState.amount >= expectedAmount) {
    // Retrieve secret from secure storage
    const secret = secureStorage.get(orderHash);
    
    // Reveal secret by withdrawing
    const tx = await destinationEscrow.withdraw(secret);
    await tx.wait();
    
    // Secret is now public in blockchain events
    console.log("Withdrawn! Secret revealed:", secret);
}
```

### Step 5: Resolver Withdraws (Monitoring Service)

```typescript
// Optional service monitors for secret reveals
async function* watchSecretReveals() {
    const filter = escrowContract.filters.SecretRevealed();
    
    for await (const event of escrowContract.queryFilter(filter)) {
        yield {
            orderHash: event.args.orderHash,
            secret: event.args.secret,
            escrowAddress: event.args.escrow
        };
    }
}

// Use revealed secret to withdraw
for await (const reveal of watchSecretReveals()) {
    await resolverContract.withdraw(
        reveal.escrowAddress,
        reveal.secret
    );
}
```

## Critical Differences from Incorrect Implementation

### ❌ Incorrect (What NOT to do)
```typescript
// WRONG: Resolver generates secret
const secret = resolver.generateSecret();
const hashlock = keccak256(secret);

// WRONG: Reactive escrow deployment
on('EscrowCreated', async (event) => {
    await deployCounterpartEscrow(event);
});

// WRONG: Resolver controls secret
await resolver.revealSecret(secret);
```

### ✅ Correct (What to do)
```typescript
// RIGHT: User generates secret
const secret = user.generateSecret();
const hashlock = keccak256(secret);

// RIGHT: Atomic order fill + escrow
await resolverContract.deploySrc(order, signature);

// RIGHT: User reveals secret
await escrow.withdraw(userSecret);
```

## Security Considerations

1. **Secret Storage**: Users must securely store secrets client-side
2. **Validation**: Users must verify destination escrow before revealing
3. **Timelocks**: Ensure adequate time for cross-chain operations
4. **Gas Management**: Resolver must have sufficient gas on both chains

## Common Mistakes to Avoid

1. **Sending secret to resolver** - Never do this
2. **Generating secrets server-side** - Always client-side
3. **Deploying escrows reactively** - Must be atomic
4. **Skipping LOP integration** - Required for 1inch
5. **Using service-only resolver** - Smart contracts required

## Testing the Flow

1. **Unit Tests**: Test each component separately
2. **Integration Tests**: Test full flow on testnet
3. **Mainnet Fork**: Test with real order data
4. **Security Audit**: Before production deployment

## Production Checklist

- [ ] Resolver contracts deployed on both chains
- [ ] Contracts verified and audited
- [ ] Frontend generates secrets client-side
- [ ] Secure client-side secret storage
- [ ] LOP integration tested
- [ ] Atomic operations verified
- [ ] Monitoring service operational
- [ ] Error handling implemented
- [ ] Documentation complete

---

This flow ensures trustless cross-chain swaps where users maintain control of their secrets throughout the process.