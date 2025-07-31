# Scripts

This directory contains scripts for development and demonstration.

## 1inch Demo Scripts

The `1inch/` subdirectory contains scripts for demonstrating the 1inch Fusion+ integration:

- `run-demo.sh` - Run the complete demo flow
- `run-fork.sh` - Start a local Ethereum mainnet fork
- `start-proxy.sh` - Start the 1inch API proxy server
- `setup-fork.ts` - Configure the forked environment
- `demo-scenario.ts` - Execute demo swap scenarios

## Usage

To run the demo:

```bash
cd scripts/1inch
./run-demo.sh
```

This will:
1. Start a local mainnet fork
2. Launch the API proxy
3. Execute demo swaps
4. Display results