# Fusion+ Extension - Base ↔ Stellar Cross-Chain Swaps

Cross-chain USDC swap implementation between Base (Ethereum L2) and Stellar networks using 1inch Fusion+ protocol.

## Overview

This project extends the 1inch Fusion+ protocol to enable seamless cross-chain swaps between Base (Ethereum L2) and Stellar networks. It implements a novel factory pattern for Stellar HTLC escrows and integrates with the 1inch resolver system.

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui
- **Smart Contracts**: 
  - Stellar: Rust/Soroban with WASM compilation
  - Stellar Factory: Deploys multiple HTLC escrows per swap
  - Ethereum: Solidity with Hardhat framework
  - Integration with 1inch Limit Order Protocol
- **Backend**: Node.js, Express, PostgreSQL
- **Integration**: 1inch Fusion SDK, ethers.js, Stellar SDK, Limit Order Protocol

## 📋 Prerequisites

- Node.js 18+ and npm
- Rust 1.70+ with `wasm32-unknown-unknown` target
- Stellar CLI (`stellar`)
- PostgreSQL 14+
- MetaMask wallet (for Ethereum)
- Freighter wallet (for Stellar)

## Key Features

- **Cross-Chain Swaps**: Seamless USDC transfers between Base and Stellar
- **Factory Pattern**: Multiple HTLC escrows per user via factory contract
- **1inch Integration**: Extended resolver supporting non-EVM chains
- **Secure Escrows**: Time-locked HTLCs with deterministic addressing
- **Full UI**: User-friendly interface for cross-chain swaps

## 🏃 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fusion-plus-xlm.git
   cd fusion-plus-xlm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development environment**
   ```bash
   # Start the database
   npm run db:start

   # In separate terminals:
   npm run dev           # Frontend
   npm run resolver:dev  # Resolver service
   npm run proxy:dev     # API proxy
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Resolver API: http://localhost:3001
   - Proxy API: http://localhost:3002

## 📁 Project Structure

```
fusion-plus-xlm/
├── frontend/              # Next.js frontend application
├── src/                   # Backend services
│   ├── services/         # Resolver and proxy services
│   ├── database/         # Data persistence layer
│   └── config/           # Configuration files
├── contracts/            # Smart contract interfaces
├── stellar-fusion/       # Stellar contract implementation
├── scripts/              # Deployment and demo scripts
│   └── 1inch/           # 1inch integration demos

```


## 💻 Development

### Running Tests

```bash
# Test everything
npm test

# Test specific components
npm run test:contracts
npm run test:resolver
npm run test:frontend
```

### Building for Production

```bash
# Build all components
npm run build

# Build specific components
npm run build:contracts
npm run build:frontend
npm run build:resolver
```

## 🚢 Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

1. **Deploy Contracts**
   ```bash
   npm run deploy:stellar
   npm run deploy:ethereum
   ```

2. **Deploy Services**
   ```bash
   # Using Docker
   docker-compose up -d

   # Or deploy to your cloud provider
   ```

## 🔒 Security

- Input validation on all user inputs
- Rate limiting on API endpoints
- Secure key management
- Time-locked escrow contracts
- Comprehensive test coverage

## 🔗 Contract Addresses

### Mainnet
- **Base Resolver**: `0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1`
- **Stellar Factory**: `CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL`

### Testnet
- **Base Resolver**: See deployment scripts
- **Stellar Factory**: `CCQZ5LB3WA7XBJQYORYUUWAJDWCM7UXIEHHDNJWFSN6E337IZ4Q43MQG`

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [1inch Network](https://1inch.io/) for the Fusion+ protocol
- [Stellar Development Foundation](https://stellar.org/) for the Stellar network


---

**Note**: This is an experimental implementation. Please review all code and test thoroughly before using in production.