#!/usr/bin/env node
import 'dotenv/config';
import { ethers } from 'ethers';
import * as StellarSdk from 'stellar-sdk';

// Chain IDs
const ETHEREUM_CHAIN_ID = 1;
const STELLAR_CHAIN_ID = 1001; // Custom ID for Stellar

// Demo configuration
const DEMO_CONFIG = {
  ethereum: {
    rpc: process.env.ETHEREUM_RPC || 'http://localhost:8545',
    resolver: '0x0000000000000000000000000000000000000001', // Mock address
    escrowFactory: '0x0000000000000000000000000000000000000002', // Mock address
  },
  stellar: {
    horizon: process.env.STELLAR_HORIZON || 'https://horizon-testnet.stellar.org',
    resolver: 'GBFZR4HFQPZQHGKZYQSV3WHJRKJPXNCBNCNVWHJSZUQJEJDZVIHDTEST', // Mock contract ID
  },
};

// Mock order structure
interface CrossChainOrder {
  srcChainId: number;
  dstChainId: number;
  orderHash: string;
  maker: string;
  taker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  hashLock: string;
}

class StellarIntegrationDemo {
  private ethProvider: ethers.JsonRpcProvider;
  private stellarServer: StellarSdk.Horizon.Server;

  constructor() {
    this.ethProvider = new ethers.JsonRpcProvider(DEMO_CONFIG.ethereum.rpc);
    this.stellarServer = new StellarSdk.Horizon.Server(DEMO_CONFIG.stellar.horizon);
  }

  // Demo: Ethereum -> Stellar swap
  async demoEthereumToStellar() {
    console.log('=== Demo: Ethereum -> Stellar Cross-Chain Swap ===\n');

    const order: CrossChainOrder = {
      srcChainId: ETHEREUM_CHAIN_ID,
      dstChainId: STELLAR_CHAIN_ID,
      orderHash: '0x' + 'a'.repeat(64),
      maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // User on Ethereum
      taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Resolver on Ethereum
      makerAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
      takerAsset: 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // USDC on Stellar
      makingAmount: BigInt('100000000'), // 100 USDC (6 decimals)
      takingAmount: BigInt('99000000'),  // 99 USDC (6 decimals, 1% fee)
      hashLock: '0x' + 'deadbeef'.repeat(8),
    };

    console.log('Order Details:');
    console.log(`- Order Hash: ${order.orderHash}`);
    console.log(`- From: Ethereum (Chain ${order.srcChainId})`);
    console.log(`- To: Stellar (Chain ${order.dstChainId})`);
    console.log(`- Maker: ${order.maker}`);
    console.log(`- Amount: 100 USDC -> 99 USDC\n`);

    // Step 1: User creates order on 1inch
    console.log('Step 1: User creates order on 1inch Fusion+');
    console.log('- Order created with hashlock\n');

    // Step 2: Resolver fills order on Ethereum
    console.log('Step 2: Resolver fills order on Ethereum');
    console.log('- Resolver deploys escrow on Ethereum');
    console.log('- 100 USDC locked in escrow');
    console.log(`- Hashlock: ${order.hashLock}\n`);

    // Step 3: Resolver deploys escrow on Stellar
    console.log('Step 3: Resolver deploys escrow on Stellar');
    console.log('- Resolver calls stellar_resolver contract');
    console.log('- Escrow deployed with matching hashlock');
    console.log('- 99 USDC funded to escrow\n');

    // Step 4: User withdraws on Stellar
    console.log('Step 4: User withdraws on Stellar');
    console.log('- User reveals secret: 0x' + 'cafebabe'.repeat(8));
    console.log('- User receives 99 USDC on Stellar\n');

    // Step 5: Resolver withdraws on Ethereum
    console.log('Step 5: Resolver uses revealed secret');
    console.log('- Resolver withdraws 100 USDC from Ethereum escrow');
    console.log('- Swap completed!\n');

    console.log('✅ Cross-chain swap completed successfully!');
  }

  // Demo: Stellar -> Ethereum swap
  async demoStellarToEthereum() {
    console.log('\n=== Demo: Stellar -> Ethereum Cross-Chain Swap ===\n');

    const order: CrossChainOrder = {
      srcChainId: STELLAR_CHAIN_ID,
      dstChainId: ETHEREUM_CHAIN_ID,
      orderHash: '0x' + 'b'.repeat(64),
      maker: 'GBFZR4HFQPZQHGKZYQSV3WHJRKJPXNCBNCNVWHJSZUQJEJDZVIHDUSER', // User on Stellar
      taker: 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTEX6V', // Resolver on Stellar
      makerAsset: 'native', // XLM
      takerAsset: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH on Ethereum
      makingAmount: BigInt('1000000000'), // 100 XLM (7 decimals)
      takingAmount: BigInt('50000000000000000'), // 0.05 ETH (18 decimals)
      hashLock: '0x' + 'feedface'.repeat(8),
    };

    console.log('Order Details:');
    console.log(`- Order Hash: ${order.orderHash}`);
    console.log(`- From: Stellar (Chain ${order.srcChainId})`);
    console.log(`- To: Ethereum (Chain ${order.dstChainId})`);
    console.log(`- Maker: ${order.maker}`);
    console.log(`- Amount: 100 XLM -> 0.05 ETH\n`);

    // Similar flow but reversed
    console.log('Step 1: User creates order (adapted for Stellar)');
    console.log('- Order created with hashlock\n');

    console.log('Step 2: Resolver deploys escrow on Stellar');
    console.log('- 100 XLM locked in escrow\n');

    console.log('Step 3: Resolver deploys escrow on Ethereum');
    console.log('- 0.05 ETH locked in escrow\n');

    console.log('Step 4: User withdraws on Ethereum');
    console.log('- User reveals secret and receives ETH\n');

    console.log('Step 5: Resolver withdraws on Stellar');
    console.log('- Resolver uses secret to withdraw XLM\n');

    console.log('✅ Cross-chain swap completed successfully!');
  }

  // Show integration architecture
  showArchitecture() {
    console.log('\n=== Integration Architecture ===\n');
    console.log('1inch Fusion+ Extension for Stellar:\n');
    console.log('┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐');
    console.log('│                 │     │                  │     │                 │');
    console.log('│  1inch Fusion+  │────▶│ Resolver Service │────▶│ Stellar Monitor │');
    console.log('│  Order System   │     │                  │     │                 │');
    console.log('└─────────────────┘     └──────────────────┘     └─────────────────┘');
    console.log('        │                        │                         │');
    console.log('        │                        │                         │');
    console.log('        ▼                        ▼                         ▼');
    console.log('   EVM Chains              Handle Both:            Stellar Chain');
    console.log('   - Ethereum              - EVM ↔ EVM              - Deploy Escrow');
    console.log('   - BSC                   - EVM ↔ Stellar          - Monitor Events');
    console.log('   - Polygon               - Stellar ↔ EVM          - Handle Secrets\n');

    console.log('Key Components:');
    console.log('1. Stellar Resolver Contract (Soroban)');
    console.log('2. Extended Resolver Service (TypeScript)');
    console.log('3. Stellar Monitor (Event Tracking)');
    console.log('4. Address Translation (EVM ↔ Stellar)\n');
  }
}

// Main execution
async function main() {
  const demo = new StellarIntegrationDemo();

  // Show architecture
  demo.showArchitecture();

  // Run demos
  await demo.demoEthereumToStellar();
  await demo.demoStellarToEthereum();

  console.log('\n🎉 Demo completed! This demonstrates how 1inch Fusion+ can be extended to support Stellar blockchain.');
  console.log('\nNext Steps:');
  console.log('1. Implement actual Soroban contract calls');
  console.log('2. Add Horizon API integration for event monitoring');
  console.log('3. Deploy contracts to Stellar testnet');
  console.log('4. Run end-to-end tests with real transactions\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}