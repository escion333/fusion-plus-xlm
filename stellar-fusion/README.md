# Stellar Fusion+ Escrow Contract

A Stellar/Soroban implementation of the 1inch Fusion+ cross-chain atomic swap protocol, enabling trustless exchanges between Ethereum and Stellar networks.

## 🚀 Project Status

**Current Phase**: Core Implementation Complete ✅
- All core features implemented and tested
- 14/14 tests passing (10 unit tests + 4 integration tests)
- WASM binary: 6.7KB (production-optimized)
- Ready for advanced features (Merkle trees, rescue_funds)

## 🌟 Features

### Core Functionality
- **Hash Time Lock Contract (HTLC)** - Secure atomic swaps with secret-hash validation
- **Multi-Stage Timelocks** - 7 configurable timelock stages for flexible cancellation/withdrawal
- **Caller Authentication** - Proper authorization checks for all sensitive operations
- **Safety Deposits** - Optional deposits to prevent griefing attacks
- **Event Emission** - Comprehensive event logging for off-chain monitoring

### Advanced Features
- **Native XLM Support** - Seamless handling of native Stellar lumens
- **Deterministic Addressing** - Cross-chain compatible address calculation
- **Initialization Protection** - Prevents double initialization attacks
- **State Machine** - Enforced valid state transitions (Active → Withdrawn/Cancelled)
- **Modular Architecture** - Clean separation of concerns for maintainability

## 📋 Contract Interface

### Core Functions

| Function | Description | Access |
|----------|-------------|---------|
| `deploy()` | Initialize new escrow with parameters | Factory/One-time |
| `withdraw(secret, unwrap_native)` | Claim funds by revealing secret | Authorized |
| `cancel(caller)` | Cancel escrow and refund | Maker/Taker (timelock dependent) |
| `public_withdraw(secret, caller)` | Withdraw after public timelock | Anyone (after timelock) |
| `get_state()` | Query current escrow state | View |
| `get_immutables()` | Get escrow configuration | View |
| `get_immutables_hash()` | Get deterministic hash of parameters | View |

### Escrow States

```rust
enum State {
    Active,     // Awaiting secret reveal
    Withdrawn,  // Secret revealed, funds claimed
    Cancelled   // Escrow cancelled, funds returned
}
```

## 🏗️ Architecture

```
stellar-fusion/
├── src/
│   ├── lib.rs              # Main contract logic & HTLC implementation
│   ├── types.rs            # Data structures & immutables hashing
│   ├── errors.rs           # Error definitions (10 error types)
│   ├── events.rs           # Event emission for monitoring
│   ├── storage.rs          # Persistent storage operations
│   ├── timelocks.rs        # Timelock validation logic
│   ├── test.rs             # Unit tests (10 tests)
│   ├── integration_test.rs # Integration tests (4 tests)
│   └── factory_example.rs  # Example factory for deterministic deployment
├── Cargo.toml              # Dependencies (Soroban SDK 23.0.0-rc.2)
├── README.md               # This file
├── TEST_RESULTS.md         # Comprehensive test results
└── FEATURE_SUMMARY.md      # Detailed feature documentation
```

## 🛠️ Development

### Prerequisites
- Rust 1.74+
- Stellar CLI
- Soroban SDK 23.0.0-rc.2

### Build
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Test
```bash
cargo test
```

### Test Status
✅ **All tests passing**: 14/14 tests (100% coverage)
- 10 unit tests covering all core functionality
- 4 integration tests demonstrating real-world scenarios

## 🚢 Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Testnet
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_escrow.wasm \
  --source SECRET_KEY \
  --network testnet
```

## 🔄 Integration Flow

1. **Order Creation** - Maker creates order on source chain (e.g., Ethereum)
2. **Escrow Deployment** - Resolver deploys matching escrows on both chains
3. **Secret Reveal** - Taker reveals secret on destination chain
4. **Completion** - Maker uses revealed secret to claim on source chain

## 🔒 Security Features

- **Timelock Protection** - Configurable timelocks prevent indefinite fund locking
- **Authentication** - All state-changing functions require proper authorization
- **Atomic Swaps** - Secret-hash mechanism ensures atomicity
- **Safety Deposits** - Optional deposits align incentives

## 📚 Documentation

- [Implementation Plan](../docs/ai-plans/stellar-fusion-implementation-plan.md) - Full project plan and status
- [Test Results](./TEST_RESULTS.md) - Current test suite analysis
- [External Docs](../docs/external-docs/) - Reference implementations and specs
- [1inch Fusion+ Docs](../docs/external-docs/1inch-docs/) - Protocol documentation

## 🎯 Next Steps

With core implementation complete, the next phase includes:
1. **Merkle Tree Support** - Enable partial fills for large orders
2. **Rescue Function** - Add `rescue_funds` for stuck funds recovery
3. **Production Factory** - Build deterministic deployment infrastructure
4. **Cross-chain Testing** - Integration with Ethereum implementation
5. **Security Audit** - Professional security review before mainnet
6. **Mainnet Deployment** - Deploy to Stellar mainnet with documentation

## 📄 License

This project is part of the 1inch Fusion+ protocol implementation.