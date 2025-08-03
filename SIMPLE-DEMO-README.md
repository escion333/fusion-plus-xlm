# 🎯 Simple HTLC Demo - Proving It Works

## Two Scripts That Actually Work

### 1. Prove Core Components Work (No Funds Needed)

```bash
npx tsx scripts/prove-htlc-works.ts
```

This shows:
- ✅ Real connection to Base mainnet
- ✅ Factory contract can predict escrow addresses  
- ✅ Stellar factory is deployed and viewable
- ✅ How the atomic swap would work with 1 USDC

### 2. Create a Real HTLC (Requires Funds)

```bash
npx tsx scripts/create-real-htlc.ts
```

This will:
- Actually create a real HTLC on Base mainnet
- Lock 1 USDC with hashlock and timelock
- Give you the secret to complete the swap
- Show transaction on Basescan

**Requirements:**
- Add `BASE_PRIVATE_KEY=0x...` to your `.env`
- Have at least 1 USDC on Base mainnet
- Have ~0.001 ETH for gas

## Real Deployed Contracts

**Base Mainnet:**
- Factory: `0xD7F8995FA708bfd382a24F59272Dc57f64Ef3282`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- View: https://basescan.org/address/0xD7F8995FA708bfd382a24F59272Dc57f64Ef3282

**Stellar Mainnet:**
- Factory: `CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL`
- View: https://stellar.expert/explorer/public/contract/CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL

## What This Proves

1. **Hashlock & Timelock** - Both preserved in our Stellar implementation
2. **Bidirectional** - Same HTLC pattern works both ways
3. **Onchain Execution** - Real contracts deployed on mainnet

No bullshit, no simulations. The contracts are deployed and they work. 