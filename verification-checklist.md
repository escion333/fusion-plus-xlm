# Stellar Fusion+ Quick Verification Checklist

## Prerequisites ✓
- [ ] Docker installed (`docker --version`)
- [ ] Docker running (whale icon in menu bar)
- [ ] Node.js installed (`node --version`)
- [ ] npm installed (`npm --version`)

## Installation ✓
- [ ] Dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)
- [ ] No security vulnerabilities reported

## Service Startup ✓
Run: `./start-local.sh`

- [ ] PostgreSQL ready
- [ ] Redis ready
- [ ] Resolver service ready
- [ ] Frontend ready

## Visual Checks ✓
- [ ] Frontend loads at http://localhost:3000
- [ ] Swap interface visible
- [ ] Chain selectors work (Ethereum/Stellar)
- [ ] Token selectors work (ETH, USDC, XLM)
- [ ] Amount inputs accept numbers

## API Health Checks ✓
- [ ] Proxy health OK: http://localhost:3002/health
- [ ] Resolver health OK: http://localhost:3001/health

## Wallet Integration ✓
- [ ] MetaMask installed
- [ ] Freighter installed
- [ ] "Connect Wallet" button clickable
- [ ] Wallet selection modal appears

## Stellar Contract ✓
Run: `cd stellar-fusion && cargo test`

- [ ] 14 tests pass
- [ ] No compilation errors

## Demo Scenario ✓
Run: `./scripts/1inch/run-demo.sh`

- [ ] All services detected as running
- [ ] Demo completes successfully

## Quick Commands

```bash
# Start everything
./start-local.sh

# Quick health check
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend" || echo "❌ Frontend"
curl -s http://localhost:3001/health > /dev/null && echo "✅ Resolver" || echo "❌ Resolver"
curl -s http://localhost:3002/health > /dev/null && echo "✅ Proxy" || echo "❌ Proxy"

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

## If Something Fails

1. **Port conflict?** → `lsof -i :3000` then `kill -9 <PID>`
2. **Docker not running?** → Open Docker Desktop
3. **Missing .env?** → Create one from .env.example
4. **Frontend blank?** → Check browser console (F12)
5. **Can't connect wallet?** → Unlock MetaMask/Freighter

## All Green? 🎉
Your Stellar Fusion+ setup is working correctly!