# Stellar Escrow Factory Contract

This factory contract enables the deployment of multiple HTLC escrow instances with deterministic addresses for the 1inch Fusion+ cross-chain swap integration.

## Overview

The factory pattern solves the single-use limitation of individual HTLC contracts by:
- Deploying new escrow instances for each swap
- Using deterministic addresses based on swap parameters
- Enabling pre-calculation of escrow addresses before deployment

## Building

```bash
./build.sh
```

This will compile and optimize the factory contract WASM.

## Deployment

### Test on Testnet First

```bash
./deploy-testnet.sh
```

This script will:
1. Deploy the HTLC template contract
2. Deploy the factory contract
3. Initialize the factory with the HTLC WASM hash
4. Test deploying an escrow instance

### Deploy to Mainnet

```bash
# Set your secret key
export STELLAR_SECRET_KEY=your_secret_key_here

# Deploy and initialize
./deploy-and-init.sh
```

## Contract Interface

### `initialize(admin: Address, htlc_wasm_hash: BytesN<32>)`
Initialize the factory with an admin address and the HTLC contract WASM hash.

### `deploy_escrow(...) -> Address`
Deploy a new HTLC escrow instance with the given parameters:
- `order_hash`: 32-byte order identifier
- `hashlock`: 32-byte hash of the secret
- `maker`: Maker's Stellar address
- `taker`: Taker's Stellar address  
- `token`: Token contract address (or native XLM address)
- `amount`: Amount to lock in the escrow
- `safety_deposit`: Safety deposit amount
- `timelocks`: Packed timelock values

Returns the address of the deployed escrow.

### `calculate_escrow_address(...) -> Address`
Calculate the deterministic address for an escrow without deploying it.
Takes the same parameters as `deploy_escrow`.

## Integration

The resolver service should:
1. Calculate the escrow address using `calculate_escrow_address`
2. Include this address in the resolver commitment
3. Deploy the actual escrow using `deploy_escrow` when filling the order
4. The deployed address will match the pre-calculated one

## Security

- Only the admin can update the HTLC WASM hash
- Each escrow is isolated with its own state
- Deterministic addresses prevent front-running
- Factory cannot access escrow funds