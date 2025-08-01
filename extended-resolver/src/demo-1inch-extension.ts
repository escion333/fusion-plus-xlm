#!/usr/bin/env node
import 'dotenv/config';
import { CrossChainCoordinator } from './CrossChainCoordinator';
import { STELLAR_CHAIN_ID } from './config';

// Configuration matching 1inch example structure
const config = {
  evmChains: [
    {
      chainId: 1, // Ethereum
      rpc: process.env.ETHEREUM_RPC || 'http://localhost:8545',
      resolverAddress: '0x1234567890123456789012345678901234567890'
    },
    {
      chainId: 56, // BSC
      rpc: process.env.BSC_RPC || 'http://localhost:8546',
      resolverAddress: '0x0987654321098765432109876543210987654321'
    }
  ],
  stellar: {
    rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    resolverContractId: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
    network: 'PUBLIC'
  }
};

async function main() {
  console.log('🚀 1inch Cross-Chain Resolver Extension Demo\n');
  console.log('This demo extends the 1inch cross-chain resolver example to support Stellar\n');

  const coordinator = new CrossChainCoordinator(config);

  // Part 1: Show their example working (Ethereum ↔ BSC)
  console.log('=== Part 1: Original 1inch Example (Ethereum ↔ BSC) ===\n');
  await demoEthereumToBSC(coordinator);

  console.log('\n' + '='.repeat(60) + '\n');

  // Part 2: Show our Stellar extension
  console.log('=== Part 2: Our Extension (Ethereum ↔ Stellar) ===\n');
  await demoEthereumToStellar(coordinator);

  console.log('\n' + '='.repeat(60) + '\n');

  // Part 3: Show reverse direction
  console.log('=== Part 3: Reverse Direction (Stellar ↔ Ethereum) ===\n');
  await demoStellarToEthereum(coordinator);

  console.log('\n✅ Demo completed successfully!');
}

async function demoEthereumToBSC(coordinator: CrossChainCoordinator) {
  console.log('📋 Demonstrating standard EVM cross-chain swap');
  console.log('   From: Ethereum USDC');
  console.log('   To: BSC USDC');
  console.log('   Amount: 100 USDC\n');

  // Create mock order matching their format
  const mockOrder = {
    maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    makerAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    takerAsset: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BSC
    makingAmount: BigInt('100000000'), // 100 USDC
    takingAmount: BigInt('99000000'),  // 99 USDC
    escrowExtension: {
      hashLockInfo: '0x' + 'a'.repeat(64),
      srcSafetyDeposit: BigInt('1000000000000000'), // 0.001 ETH
      timeLocks: {
        srcWithdrawal: 120n,
        dstWithdrawal: 100n,
        // ... other timelocks
      }
    },
    getOrderHash: (chainId: number) => '0x' + 'order1'.padEnd(64, '0')
  };

  console.log('Step 1: User creates cross-chain order');
  console.log('Step 2: Resolver fills order on Ethereum');
  console.log('Step 3: Resolver deploys escrow on BSC');
  console.log('Step 4: User reveals secret on BSC');
  console.log('Step 5: Resolver claims on Ethereum\n');

  // Simulate the swap
  const result = await coordinator.handleCrossChainOrder({
    order: mockOrder,
    signature: '0x' + 'sig'.repeat(43),
    srcChainId: 1,
    dstChainId: 56
  });

  console.log('✅ Ethereum ↔ BSC swap completed (1inch standard flow)');
  console.log(`   Source escrow: ${result.srcEscrow}`);
  console.log(`   Destination escrow: ${result.dstEscrow}\n`);
}

async function demoEthereumToStellar(coordinator: CrossChainCoordinator) {
  console.log('📋 Demonstrating our Stellar extension');
  console.log('   From: Ethereum USDC');
  console.log('   To: Stellar USDC');
  console.log('   Amount: 100 USDC\n');

  const mockOrder = {
    maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    makerAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    takerAsset: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', // USDC on Stellar
    makingAmount: BigInt('100000000'), // 100 USDC
    takingAmount: BigInt('99000000'),  // 99 USDC
    escrowExtension: {
      hashLockInfo: '0x' + 'b'.repeat(64),
      srcSafetyDeposit: BigInt('1000000000000000'),
      timeLocks: {
        srcWithdrawal: 120n,
        dstWithdrawal: 100n,
        dstPublicWithdrawal: 200n,
        dstCancellation: 300n
      }
    },
    getOrderHash: (chainId: number) => '0x' + 'order2'.padEnd(64, '0')
  };

  console.log('Step 1: User creates cross-chain order with Stellar destination');
  console.log('Step 2: Resolver fills order on Ethereum (same as BSC flow)');
  console.log('Step 3: Resolver deploys escrow on Stellar (NEW!)');
  console.log('   - Calls Stellar resolver contract');
  console.log('   - Contract ID: CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU');
  console.log('Step 4: User reveals secret on Stellar');
  console.log('Step 5: Resolver claims on Ethereum\n');

  const result = await coordinator.handleCrossChainOrder({
    order: mockOrder,
    signature: '0x' + 'sig'.repeat(43),
    srcChainId: 1,
    dstChainId: STELLAR_CHAIN_ID
  });

  console.log('✅ Ethereum ↔ Stellar swap completed!');
  console.log(`   Source escrow: ${result.srcEscrow}`);
  console.log(`   Destination escrow: ${result.dstEscrow}`);
  console.log('   View on Stellar Expert: https://stellar.expert/explorer/public/contract/CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU\n');
}

async function demoStellarToEthereum(coordinator: CrossChainCoordinator) {
  console.log('📋 Demonstrating reverse direction');
  console.log('   From: Stellar XLM');
  console.log('   To: Ethereum ETH');
  console.log('   Amount: 100 XLM\n');

  const mockOrder = {
    maker: 'GBFZR4HFQPZQHGKZYQSV3WHJRKJPXNCBNCNVWHJSZUQJEJDZVIHDTEST',
    taker: 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTEX6V',
    makerAsset: 'native', // XLM
    takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    makingAmount: BigInt('1000000000'), // 100 XLM (7 decimals)
    takingAmount: BigInt('50000000000000000'), // 0.05 ETH
    hashLock: '0x' + 'c'.repeat(64),
    timeLocks: {
      withdrawal: 120n,
      publicWithdrawal: 200n,
      cancellation: 300n
    }
  };

  console.log('Step 1: User creates order on Stellar side');
  console.log('Step 2: Resolver deploys escrow on Stellar');
  console.log('Step 3: Resolver deploys escrow on Ethereum');
  console.log('Step 4: User reveals secret on Ethereum');
  console.log('Step 5: Resolver claims on Stellar\n');

  const result = await coordinator.handleCrossChainOrder({
    order: mockOrder,
    signature: 'stellar_signature_format',
    srcChainId: STELLAR_CHAIN_ID,
    dstChainId: 1
  });

  console.log('✅ Stellar ↔ Ethereum swap completed!');
  console.log(`   Source escrow: ${result.srcEscrow}`);
  console.log(`   Destination escrow: ${result.dstEscrow}\n`);
}

// Architecture diagram
function showArchitecture() {
  console.log('\n=== Extension Architecture ===\n');
  console.log('Standard 1inch Flow:');
  console.log('┌─────────────┐     ┌─────────────┐     ┌─────────────┐');
  console.log('│   Ethereum  │────▶│   Resolver  │────▶│     BSC     │');
  console.log('│   Contract  │     │   Service   │     │   Contract  │');
  console.log('└─────────────┘     └─────────────┘     └─────────────┘');
  console.log('\nOur Extension:');
  console.log('┌─────────────┐     ┌─────────────┐     ┌─────────────┐');
  console.log('│   Ethereum  │────▶│   Extended  │────▶│   Stellar   │');
  console.log('│   Contract  │     │   Resolver  │     │   Contract  │');
  console.log('└─────────────┘     └─────────────┘     └─────────────┘');
  console.log('                           │');
  console.log('                           ▼');
  console.log('                    Handles both:');
  console.log('                    - EVM chains (original)');
  console.log('                    - Stellar (our addition)\n');
}

// Run the demo
if (require.main === module) {
  showArchitecture();
  main().catch(console.error);
}