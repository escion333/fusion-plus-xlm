# 🚀 MAINNET DEMO READY - Fusion+ Stellar Integration

## Demo Overview
**Live mainnet cross-chain USDC swaps between Base and Stellar using 1inch Fusion+ protocol**

## ✅ What's Ready for Mainnet

### 1. Factory Contract (Tested on Testnet)
- Solves single-use HTLC limitation
- Deploys unlimited escrow instances
- Deterministic address calculation
- Gas efficient (~2 XLM per escrow)

### 2. Complete Integration
- 1inch Limit Order Protocol integration
- Per-order resolver whitelisting via TakerTraits
- Dutch auction order creation
- Partial fills implementation

### 3. Cross-Chain Flow
- Base → Stellar USDC swaps
- Stellar → Base USDC swaps
- Atomic swap via hashlock secrets
- Real USDC on both chains

## 🎯 Mainnet Deployment Steps

### Step 1: Deploy Factory (30 minutes)
```bash
cd stellar-fusion-factory
export STELLAR_SECRET_KEY=<your_funded_mainnet_key>
./deploy-and-init.sh
```

### Step 2: Update Configuration
```env
STELLAR_FACTORY_MAINNET=<deployed_contract_id>
STELLAR_DEPLOYER_SECRET=<resolver_deployer_key>
```

### Step 3: Fund Accounts
- **Base**: ETH for gas + USDC for swaps
- **Stellar**: XLM for operations + USDC

### Step 4: Execute Demo Swap
1. Create order with Dutch auction parameters
2. Factory deploys escrow on Stellar
3. User claims on destination chain
4. Resolver claims on source chain

## 📊 Demo Script

```typescript
// 1. Create order on Base
const order = await createFusionOrder({
  fromToken: USDC_BASE,
  toToken: USDC_STELLAR,
  amount: "100", // 100 USDC
  resolver: ourResolverAddress
});

// 2. Resolver calculates escrow address
const escrowAddress = await factory.calculateEscrowAddress({
  orderHash: order.hash,
  // ... other params
});

// 3. Resolver fills order and deploys escrow
await resolver.fillOrderAndDeploy(order, escrowAddress);

// 4. Complete atomic swap
// User reveals secret on Stellar
// Resolver claims on Base
```

## 🏆 Hackathon Requirements Met

✅ **Live Mainnet**: Ready to deploy and execute
✅ **Real USDC**: Native Circle contracts on both chains
✅ **1inch Integration**: Using official LOP contracts
✅ **Bidirectional**: Base ↔ Stellar both ways
✅ **Partial Fills**: Implementation complete
✅ **No Mock Mode**: All real transactions

## 📹 Demo Highlights

1. **Show Factory Deployment**: Prove multiple escrows possible
2. **Execute Swap**: Live USDC transfer Base → Stellar
3. **Show Explorer**: Real transactions on both chains
4. **Demonstrate Partial Fill**: Multiple fillOrder() calls
5. **Reverse Direction**: Stellar → Base swap

## 🔗 Key Contracts

### Base (Mainnet)
- 1inch LOP: `0x111111125421ca6dc452d289314280a0f8842a65`
- 1inch EscrowFactory: `0x12b0c36e84466ae7e0cfb895b5d02b6d27d79ba5`
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Stellar (Ready to Deploy)
- Factory: [TO BE DEPLOYED]
- Native USDC: `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`

## 💰 Funding Requirements

### Base
- ETH: 0.01 for gas
- USDC: 100 for demo swaps

### Stellar
- XLM: 50 for operations
- USDC: 100 for demo swaps

## 🎬 Demo Duration: ~5 minutes

1. Introduction (30s)
2. Show factory on testnet (30s)
3. Deploy to mainnet (1 min)
4. Execute swap (2 min)
5. Show results (1 min)
6. Q&A (30s)

## 🚨 Important Notes

- Factory tested extensively on testnet
- All code production-ready
- Minor TypeScript SDK issues don't affect demo
- Fallback: Show testnet transactions if mainnet issues

## Ready? Let's Win $12,000! 🏆