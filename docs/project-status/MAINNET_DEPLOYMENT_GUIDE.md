# Mainnet Deployment Guide for Real Testing

This guide will help you deploy to mainnet and test real asset transfers between Stellar and Ethereum using 1inch Fusion+.

## Prerequisites

- [x] Stellar CLI installed (you have v23.0.0 ✓)
- [x] At least 100 XLM for Stellar deployment (✅ 110 XLM available)
- [ ] At least 0.05 ETH for Ethereum gas (if deploying custom contracts)
- [x] 1inch API key from https://portal.1inch.dev/ (✅ Configured)

## Step 1: Stellar Mainnet Deployment ✅ COMPLETED

### 1.1 Mainnet Account Status
- Test wallet configured: `GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK`
- Balance: 110 XLM ✓

### 1.2 Deployed Contracts

**Production Contract:**
```
CBPL4TVZUM4TAHSRISO4CNNPWAIGMQLUN5MB4MDVZ5ZL3SRRTN56CVNG
```

**Successfully Tested Contract:**
```
CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU
```
- ✅ Complete HTLC flow verified with real XLM
- ✅ Native XLM support via SAC: `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`

### 1.3 Verify Deployment

View deployed contracts on Stellar Expert:
- [Production Contract](https://stellar.expert/explorer/public/contract/CBPL4TVZUM4TAHSRISO4CNNPWAIGMQLUN5MB4MDVZ5ZL3SRRTN56CVNG)
- [Test Contract](https://stellar.expert/explorer/public/contract/CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU)
- [Successful Withdrawal TX](https://stellar.expert/explorer/public/tx/3b5b8935203e331b3dff64233485072ba3181266d5d66ebcf43fc3052fed006d)

## Step 2: Configure 1inch Integration

### 2.1 Get 1inch API Key

1. Visit https://portal.1inch.dev/
2. Sign up/login and create a new app
3. Copy your API key

### 2.2 Update Environment

Edit `.env.mainnet` and add your 1inch API key:
```
ONEINCH_API_KEY=your_actual_api_key_here
```

## Step 3: Frontend Configuration

### 3.1 Update Frontend Environment

Create `frontend/.env.production`:
```bash
cd frontend
cp .env.local .env.production
```

Edit the file with mainnet values:
```
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_ETHEREUM_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID
NEXT_PUBLIC_ETHEREUM_ESCROW_FACTORY=0xfb742d35dd3a3ca8da4a79ac062064164845c6b9
NEXT_PUBLIC_API_URL=https://api.1inch.dev
```

### 3.2 Deploy Frontend

Option A: Deploy to Vercel (Recommended)
```bash
cd frontend
vercel --prod
```

Option B: Build and host elsewhere
```bash
npm run build
# Upload the .next folder to your hosting provider
```

## Step 4: Start Services Locally (for Testing)

### 4.1 Start API Proxy

```bash
# From project root
npm run proxy:prod
```

This starts the 1inch API proxy on port 3002.

### 4.2 Access Your App

- Frontend: Your deployed URL or http://localhost:3000
- API Proxy: http://localhost:3002

## Step 5: Test Real Swaps

### 5.1 Prepare Test Wallets

1. **MetaMask (Ethereum)**:
   - Switch to Ethereum Mainnet
   - Have at least 0.1 ETH for gas
   - Have some USDC or ETH to swap

2. **Freighter (Stellar)**:
   - Switch to Public Network (Mainnet)
   - Have at least 10 XLM
   - Ensure trustlines are set up for USDC if needed

### 5.2 Create Your First Swap

1. Open your frontend
2. Connect both wallets
3. Start with a small test (e.g., $10-20)
4. Select ETH/USDC on Ethereum → XLM on Stellar
5. Click "Swap"

### 5.3 How It Works

1. Your swap order is created and sent to 1inch
2. 1inch resolvers see your order and compete to fill it
3. A resolver will:
   - Deploy escrows on both chains
   - Lock your assets on the source chain
   - Deliver assets on the destination chain
4. The swap completes atomically (all-or-nothing)

## Important Notes

### Security
- Start with SMALL amounts ($10-50) for testing
- Increase amounts gradually as you gain confidence
- Never share your private keys

### Gas Costs
- Ethereum: ~$5-20 per transaction depending on network
- Stellar: ~0.01 XLM per transaction (very cheap)

### Timing
- Swaps typically complete in 2-10 minutes
- Depends on resolver competition and network congestion

### What We DON'T Need
- We don't need to run a resolver
- We don't need KYC/whitelisting
- We don't need to deploy Ethereum contracts (using 1inch's)

## Troubleshooting

### "No resolvers available"
- Ensure your swap amount is reasonable ($50+)
- Check that both chains are on mainnet
- Verify 1inch API key is correct

### "Transaction failed"
- Check you have enough gas (ETH) and reserves (XLM)
- Ensure token approvals are set
- Try a smaller amount

### "Cannot connect wallet"
- Ensure wallets are on mainnet
- Refresh the page
- Check browser console for errors

## Next Steps

After successful testing:
1. Document your results
2. Increase swap amounts gradually
3. Test different token pairs
4. Monitor gas costs and timing
5. Gather feedback for improvements

## Support

- 1inch Discord: https://discord.gg/1inch
- Stellar Discord: https://discord.gg/stellar
- Our GitHub: [your-repo-url]

Remember: This is real money on mainnet. Start small and be careful!