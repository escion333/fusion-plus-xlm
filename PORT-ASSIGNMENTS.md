# Fusion+ Port Assignments

## Main System Ports (Production)
- **Port 3000**: Frontend Web Interface
- **Port 3002**: API Proxy Service (routes to 1inch API)
- **Port 3003**: Extended Resolver Service (manages atomic swaps)

## Demo Ports (simple-working-demo.ts)
- **Port 3011**: Simple Relayer Service (demo only)
- **Port 3012**: Simple Resolver Service (demo only)

## Service Descriptions

### Frontend (Port 3000)
- Web interface for users
- MetaMask integration
- Real-time swap monitoring

### API Proxy (Port 3002)
- Gateway to 1inch API
- Handles rate limiting
- API key management
- CORS support

### Extended Resolver (Port 3003)
- Cross-chain atomic swap coordinator
- Manages HTLC escrows on Base and Stellar
- Monitors blockchain events
- Handles secret reveals

### Simple Demo Services (Ports 3011-3012)
- Standalone demo components
- Simplified versions for testing
- No conflict with main system

## Running Services

### Full System
```bash
# Start all main services
npm run start-all-services

# Or individually:
npm run proxy      # Port 3002
npm run resolver   # Port 3003
npm run frontend   # Port 3000
```

### Demo Only
```bash
# Run simple demo (uses ports 3011-3012)
npx tsx scripts/simple-working-demo.ts
```

### Complete Demo (Frontend + Backend)
```bash
# Starts frontend + demo services
npx tsx scripts/start-complete-demo.ts
```