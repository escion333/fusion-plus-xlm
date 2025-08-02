#!/bin/bash

# Build the factory contract
echo "🔨 Building Stellar Escrow Factory contract..."

# Build in release mode
cargo build --target wasm32-unknown-unknown --release

# Optimize the WASM
echo "🔧 Optimizing WASM..."
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm

echo "✅ Factory contract built successfully!"
echo "📦 Output: target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm"

# Show the size
ls -lh target/wasm32-unknown-unknown/release/stellar_escrow_factory.optimized.wasm