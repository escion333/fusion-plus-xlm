# Mainnet Deployment Checklist

## What's Ready for Mainnet Testing

### ✅ Completed Setup

1. **Stellar Contract** (Ready to Deploy)
   - Optimized WASM binary (6.8KB)
   - Deployment script: `./scripts/deploy-stellar-mainnet.sh`
   - Full HTLC implementation with 1inch compatibility
   
2. **Ethereum Integration**
   - Using 1inch's existing Escrow Factory: `0xfb742d35dd3a3ca8da4a79ac062064164845c6b9`
   - No additional contracts needed

3. **Environment Configuration**
   - `.env.mainnet` - Main configuration file
   - API setup script: `./scripts/setup-mainnet-api.sh`
   - Test script: `./scripts/test-1inch-api.js`

4. **Frontend & API Proxy**
   - Mainnet-ready configuration
   - Production build commands
   - 1inch API integration

## Quick Start Commands

```bash
# 1. Deploy Stellar Contract (need funded account)
./scripts/deploy-stellar-mainnet.sh YOUR_ACCOUNT_NAME

# 2. Configure 1inch API
./scripts/setup-mainnet-api.sh

# 3. Test API Connection
node scripts/test-1inch-api.js

# 4. Build Project
npm run build

# 5. Start API Proxy
npm run proxy:prod

# 6. Deploy Frontend
cd frontend && vercel --prod
```

## Required Resources

- [ ] 100+ XLM for Stellar deployment and operations
- [ ] 0.1+ ETH for Ethereum gas fees
- [ ] 1inch API key from https://portal.1inch.dev/
- [ ] Test funds for swaps ($50-100 recommended)

## How Testing Works

1. **You provide liquidity** by creating swap orders
2. **1inch resolvers** compete to fill your orders
3. **Atomic swaps** execute across both chains
4. **You receive assets** on the destination chain

## Important Notes

- We're NOT running a resolver (1inch handles that)
- We're NOT deploying to Ethereum (using 1inch contracts)
- Start with SMALL amounts ($10-20) for safety
- Monitor gas costs carefully

## Support Documentation

- `MAINNET_DEPLOYMENT_GUIDE.md` - Detailed deployment steps
- `VERIFICATION_GUIDE.md` - Testing procedures
- `docs/` - Technical documentation

## Safety Reminders

⚠️ **This is REAL MONEY on MAINNET**
- Double-check all addresses
- Start with minimal amounts
- Keep private keys secure
- Monitor transactions closely