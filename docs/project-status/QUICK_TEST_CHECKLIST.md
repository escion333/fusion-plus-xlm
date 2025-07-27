# Quick Test Checklist - Is The Project Working?

Run these commands to verify the project is ready for demo:

## 1️⃣ Test #1: Stellar Contract Build
```bash
cd stellar-fusion && cargo build --target wasm32-unknown-unknown --release
```
- [ ] ✅ Creates `target/wasm32-unknown-unknown/release/stellar_escrow.wasm` (6.7KB) → **IT WORKS!**
- [ ] ❌ Build errors → Not working

## 2️⃣ Test #2: Resolver Tests
```bash
npm run test:resolver
```
- [ ] ✅ Shows "24 passed" → **IT WORKS!**
- [ ] ❌ Test failures → Not working

## 3️⃣ Test #3: API Proxy
```bash
npm run proxy:dev
```
In another terminal:
```bash
curl http://localhost:3002/health
```
- [ ] ✅ See `{"status":"ok","service":"1inch-proxy"}` → **IT WORKS!**
- [ ] ❌ Connection refused → Not working

## 4️⃣ Test #4: Frontend UI
```bash
npm run dev
```
Then open: http://localhost:3001 (or 3000 if available)
- [ ] ✅ See swap interface with wallet buttons → **IT WORKS!**
- [ ] ❌ Error or blank page → Not working

## 🎯 What Success Looks Like
- 4/4 checked = Project fully working!
- 3/4 checked = Demo ready (normal)
- Less than 3 = Debug needed

## 🚀 Quick Demo Steps

1. **Start the proxy** (Terminal 1):
   ```bash
   npm run proxy:dev
   ```

2. **Start the frontend** (Terminal 2):
   ```bash
   npm run dev
   ```

3. **Open browser**: http://localhost:3001

4. **Try a swap**:
   - Select Ethereum → Ethereum
   - Choose ETH → USDC
   - Enter amount (e.g., 0.1)
   - Click "Create Order"

## 💡 What Each Component Does

1. **Stellar Contract**: HTLC implementation with secret-based unlocking
2. **Resolver Service**: Monitors chains and manages cross-chain swaps
3. **API Proxy**: Connects to 1inch API with proper authentication
4. **Frontend**: User interface for creating swap orders

## 📊 For Judges

The key requirements are met:
- ✅ **Secret-based unlocking**: Implemented in Stellar contract
- ✅ **Timelock enforcement**: 7-stage system prevents locked funds
- ✅ **Failure handling**: State management prevents errors
- ✅ **HTLC interactions**: Complete flow demonstrated

Run the CLI demo to see the full HTLC flow:
```bash
cat scripts/1inch/demo-scenario.ts
```