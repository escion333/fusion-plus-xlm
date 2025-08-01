# Fusion+ Extension

Cross-chain swap interface between Ethereum and Stellar networks using 1inch Fusion+ protocol.

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui
- **Smart Contracts**: 
  - Stellar: Rust/Soroban with WASM compilation
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

## 🎬 Demo the Integration

### Run the Mainnet Demo
```bash
# Navigate to extended resolver
cd extended-resolver

# Install dependencies
npm install

# Run the mainnet demo
npm run demo:mainnet
```

This will show:
- ✅ Deployed mainnet contract details
- ✅ Cross-chain swap flow demonstration
- ✅ Real transaction proof
- ✅ Integration architecture

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
   # The .env file is pre-configured for demo mode
   # To use with real mainnet, update the following in .env:
   # - ETHEREUM_RPC_URL: Add your Infura/Alchemy API key
   # - MOCK_MODE: Set to false for real transactions
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

⚠️ **Important**: The resolver architecture requires significant changes. See `docs/ai-plans/resolver-contract-specification.md` for the correct implementation.

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

See [SECURITY.md](SECURITY_IMPROVEMENTS.md) for detailed security measures.

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

## Full Hackathon Context (New)

[Insert summary, including relayer/resolver details, no non-EVM LOP requirement, etc.]

---

**Note**: This is an experimental implementation. Please review all code and test thoroughly before using in production.