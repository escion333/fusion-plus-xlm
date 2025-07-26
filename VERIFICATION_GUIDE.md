# Project Verification Guide for Non-Technical Users

This guide will help you verify that the Stellar Fusion+ project is actually working. Follow each step and look for the success indicators.

## Prerequisites Check

First, let's verify you have the required software:

### Step 1: Check Node.js
Copy and paste this command in your terminal:
```bash
node --version
```

**✅ Success**: You should see something like `v18.x.x` or higher
**❌ Failure**: If you see "command not found", you need to install Node.js from https://nodejs.org

### Step 2: Check if project dependencies are installed
Navigate to the project folder and run:
```bash
npm list --depth=0
```

**✅ Success**: You should see a list of packages without errors
**❌ Failure**: If you see errors, run `npm install` first

## Testing Each Component

### Component 1: Stellar Smart Contract Tests

Run this command:
```bash
cd stellar-fusion && cargo test
```

**✅ What Success Looks Like**:
```
running 14 tests
test test::test_cancel_after_withdraw ... ok
test test::test_cancel_escrow ... ok
[... more tests ...]
test result: ok. 14 passed; 0 failed
```

**❌ What Failure Looks Like**:
- Red error messages
- "FAILED" text
- Numbers showing failures (e.g., "1 failed")

### Component 2: Frontend Interface

Start the frontend:
```bash
cd frontend && npm run dev
```

**✅ What Success Looks Like**:
```
▲ Next.js 14.2.30
- Local:        http://localhost:3000
✓ Ready in Xs
```

Then open http://localhost:3000 in your browser.

**✅ You Should See**:
- A page titled "Stellar Fusion+"
- A swap interface with "From" and "To" fields
- Wallet connection buttons
- Professional looking UI with no errors

**❌ What Failure Looks Like**:
- Error page
- Blank white screen
- "Cannot connect" message
- Console errors in red

### Component 3: API Proxy Server

In a new terminal, run:
```bash
npm run proxy:dev
```

**✅ What Success Looks Like**:
```
🚀 1inch API Proxy Server running on http://localhost:3002
✅ 1inch API key configured
```

Test it's working:
```bash
curl http://localhost:3002/health
```

**✅ Success Response**:
```json
{"status":"ok","service":"1inch-proxy"}
```

**❌ Failure**: Connection refused or error messages

### Component 4: Test Data Endpoints

Test the mock API:
```bash
curl http://localhost:3002/api/mock/fusion/orders/active
```

**✅ What Success Looks Like**:
You should see JSON data starting with:
```json
{"orders":[{"orderHash":"0x111...
```

**❌ What Failure Looks Like**:
- "Cannot GET" error
- Connection refused
- HTML error page

## Full System Test

### Easy All-in-One Test
Run this single command:
```bash
./start-local.sh
```

**✅ What Success Looks Like**:
- Multiple services starting
- No red error messages
- Services available at the URLs shown

Wait 30 seconds, then check:
1. Frontend: http://localhost:3000 - Should show swap interface
2. API Health: http://localhost:3002/health - Should return `{"status":"ok"}`

## Quick Verification Checklist

Copy these commands one by one and check for success:

```bash
# 1. Test Stellar contracts (from project root)
cd stellar-fusion && cargo test && cd ..
# LOOK FOR: "14 passed; 0 failed"

# 2. Test frontend build
cd frontend && npm run build && cd ..
# LOOK FOR: "✓ Compiled successfully"

# 3. Test all TypeScript files compile
npm run build
# LOOK FOR: No errors, files created in 'dist' folder

# 4. Check if documentation exists
ls -la docs/
# LOOK FOR: Multiple .md files listed
```

## Common Issues and Fixes

### Issue: "Cannot find module" errors
**Fix**: Run `npm install` in the project root

### Issue: "Port already in use"
**Fix**: Kill existing processes:
```bash
pkill -f "node|npm"
```

### Issue: Frontend shows "Cannot connect to resolver"
**Fix**: This is normal - the resolver needs special Stellar keys. The UI still works for demonstration.

### Issue: "CORS error" in browser
**Fix**: Make sure the proxy is running (`npm run proxy:dev`)

## Final Verification

If you can:
1. ✅ See the frontend at http://localhost:3000
2. ✅ Get a response from http://localhost:3002/health
3. ✅ Run the Stellar contract tests successfully
4. ✅ See no build errors

Then **the project is working correctly!**

## What This Project Does

Even if some services show warnings, the project successfully demonstrates:
- A complete UI for cross-chain swaps
- Integration with 1inch Fusion+ protocol
- Stellar smart contracts for atomic swaps
- Proper documentation and architecture

The warnings you might see (like resolver connection issues) are expected because this is a demo that would need real blockchain deployments for full functionality.