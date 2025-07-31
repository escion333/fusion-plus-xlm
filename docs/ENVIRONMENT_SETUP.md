# Environment Configuration Guide

## Overview
This guide explains the environment configuration for the Fusion+ XLM project. The configuration has been consolidated from multiple files into a single `.env` file for simplicity.

## Current Configuration

### Main Environment File: `.env`

```bash
# Stellar Configuration (Mainnet)
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_CONTRACT_ID=CBPL4TVZUM4TAHSRISO4CNNPWAIGMQLUN5MB4MDVZ5ZL3SRRTN56CVNG
STELLAR_TEST_WALLET_SECRET=SCD4JV3O4LOD3GBS27NADT72T7USEAZWKVLVKCERCSH62QJDPFEOFLL6
STELLAR_TEST_WALLET_PUBLIC=GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK

# Native XLM SAC Address (verified on mainnet)
STELLAR_XLM_SAC=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA

# 1inch Integration
ONEINCH_API_KEY=your_api_key_here
ONEINCH_API_URL=https://api.1inch.dev

# Ethereum Configuration
ETHEREUM_NETWORK=mainnet
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
ETHEREUM_CHAIN_ID=1
ETHEREUM_ESCROW_FACTORY=0xfb742d35dd3a3ca8da4a79ac062064164845c6b9

# Database (for resolver service)
DATABASE_URL=postgresql://user:password@localhost:5432/fusion_xlm

# Service Ports
API_PROXY_PORT=3002
RESOLVER_PORT=3001
FRONTEND_PORT=3000
```

### Frontend Environment: `frontend/.env.local`

```bash
# Network Configuration
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_NETWORK=public
NEXT_PUBLIC_ETHEREUM_NETWORK=mainnet

# Contract Addresses
NEXT_PUBLIC_STELLAR_CONTRACT_ID=CBPL4TVZUM4TAHSRISO4CNNPWAIGMQLUN5MB4MDVZ5ZL3SRRTN56CVNG
NEXT_PUBLIC_ETHEREUM_ESCROW_FACTORY=0xfb742d35dd3a3ca8da4a79ac062064164845c6b9

# API Endpoints
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_RESOLVER_URL=http://localhost:3001

# Feature Flags
NEXT_PUBLIC_MOCK_MODE=false
NEXT_PUBLIC_ENABLE_MAINNET=true
```

## Environment Setup Steps

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Configure Stellar Settings
- `STELLAR_CONTRACT_ID`: Your deployed HTLC contract (already deployed)
- `STELLAR_TEST_WALLET_SECRET`: Your funded Stellar wallet secret key
- Keep `STELLAR_NETWORK=mainnet` for production

### 3. Configure 1inch API
- Get API key from https://portal.1inch.dev/
- Replace `your_api_key_here` with actual key

### 4. Configure Ethereum (Optional)
- Only needed if running custom resolver
- Use Alchemy, Infura, or other RPC provider

### 5. Frontend Configuration
```bash
cd frontend
cp .env.local.example .env.local
```
- Update contract addresses to match mainnet deployment
- Set `NEXT_PUBLIC_MOCK_MODE=false` for production

## Security Notes

⚠️ **NEVER commit `.env` files to git**
- `.env` files are gitignored by default
- Use environment variables in production deployments
- Rotate keys if accidentally exposed

## Verified Mainnet Values

These values have been tested and verified on mainnet:

| Variable | Value | Status |
|----------|-------|--------|
| STELLAR_CONTRACT_ID | CBPL4TVZUM4TAHSRISO4CNNPWAIGMQLUN5MB4MDVZ5ZL3SRRTN56CVNG | ✅ Deployed |
| STELLAR_XLM_SAC | CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA | ✅ Working |
| Test Wallet | GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK | ✅ 110 XLM |

## Troubleshooting

### "Invalid API Key"
- Verify 1inch API key is correct
- Check for extra spaces or quotes

### "Network Mismatch"
- Ensure all network settings are consistent (mainnet/public)
- Frontend and backend must use same network

### "Contract Not Found"
- Verify contract addresses are correct
- Check Stellar Expert for deployment status

## Production Deployment

For production deployments:
1. Use environment variables instead of .env files
2. Store secrets in secure key management system
3. Enable HTTPS for all endpoints
4. Configure CORS appropriately
5. Set up monitoring and alerts