# Ethereum Deployment Requirements

## Current Status

### ✅ What We Have:
1. **Stellar Contract** - Deployed and tested on mainnet
2. **Extended Resolver Service** - Coordinates between chains
3. **Frontend** - Ready to create orders

### ❌ What's Missing on Ethereum:
1. **Resolver Smart Contract** - Not deployed
2. **ETH for deployment** - ~0.1 ETH needed
3. **Capital for filling orders** - USDC/ETH to actually fill swaps

## Required Ethereum Contracts

### 1. Resolver Contract (Like in 1inch Example)
```solidity
contract StellarResolver {
    IEscrowFactory escrowFactory; // 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a
    IOrderMixin limitOrderProtocol; // 0x111111125421ca6dc452d289314280a0f8842a65
    
    function deploySrc(...) {
        // 1. Fill order via LOP
        // 2. Deploy escrow
        // 3. Send safety deposit
    }
    
    function withdraw(...) {
        // Withdraw using revealed secret
    }
}
```

### 2. Deployment Cost Estimate
- Contract deployment: ~0.05 ETH
- Each swap requires:
  - Gas for filling order: ~0.01 ETH
  - Safety deposit: 0.001 ETH (refundable)
  - Capital to fill order: Amount being swapped

## Why Our Demo is Currently Simulated

Without the Ethereum resolver contract:
1. ❌ Can't fill orders on 1inch LOP
2. ❌ Can't deploy escrows via factory
3. ❌ Can't complete real cross-chain swaps

Our demo shows the architecture and flow, but transactions are mocked.

## What Would Make It Real

### Option 1: Deploy Resolver Contract (Expensive)
1. Deploy resolver contract (~$150 in gas)
2. Fund with capital for swaps
3. Register as 1inch resolver (may need KYC)

### Option 2: Partner with Existing Resolver
1. Find a 1inch resolver willing to test
2. They handle Ethereum side
3. We handle Stellar side

### Option 3: Testnet Demo
1. Deploy on Sepolia/Goerli
2. Use testnet 1inch contracts
3. Show working flow without mainnet costs

## Hackathon Approach

For the hackathon, we can:
1. **Show the architecture** ✅
2. **Prove Stellar integration** ✅
3. **Demonstrate the flow** ✅
4. **Explain what's needed for production** ✅

The judges will understand that deploying a full resolver on mainnet is expensive and not expected for a hackathon proof-of-concept.

## Key Message

"We've proven the non-EVM integration works. The Stellar side is live on mainnet. The Ethereum side follows 1inch's exact pattern - we just need to deploy the resolver contract when ready for production."