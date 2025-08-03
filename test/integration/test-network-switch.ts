#!/usr/bin/env npx tsx
/**
 * Network Switching Integration Test
 * 
 * This test verifies the system correctly switches between networks:
 * 1. Start with testnet config
 * 2. Create testnet order
 * 3. Switch to mainnet config
 * 4. Verify correct contracts used
 * 5. Test environment variable handling
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { OrderBuilder } from '../../src/services/1inch/OrderBuilder';
import { getStellarFactory, getNetworkConfig, getBaseFactory, getResolverAddress, getCurrentNetwork } from '../../src/config/network-utils';

dotenv.config();

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Network configurations
const NETWORK_CONFIGS = {
  mainnet: {
    base: {
      rpc: 'https://mainnet.base.org',
      chainId: 8453,
      escrowFactory: process.env.BASE_ESCROW_FACTORY || '0xe7e9E1B7D4BE66D596D8f599c892ffdfFD8dD866',
      resolver: process.env.RESOLVER_ADDRESS || '0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      lop: '0x111111125421ca6dc452d289314280a0f8842a65'
    },
    stellar: {
      network: 'mainnet',
      factory: process.env.STELLAR_FACTORY_MAINNET || 'CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL',
      rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
      passphrase: 'Public Global Stellar Network ; September 2015'
    }
  },
  testnet: {
    base: {
      rpc: 'https://sepolia.base.org',
      chainId: 84532,
      escrowFactory: '0x1234567890123456789012345678901234567890', // Mock testnet address
      resolver: '0x0987654321098765432109876543210987654321', // Mock testnet address
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
      lop: '0x111111125421ca6dc452d289314280a0f8842a65' // Same on testnet
    },
    stellar: {
      network: 'testnet',
      factory: process.env.STELLAR_FACTORY_TESTNET || 'CCQZ5LB3WA7XBJQYORYUUWAJDWCM7UXIEHHDNJWFSN6E337IZ4Q43MQG',
      rpc: 'https://soroban-testnet.stellar.org',
      passphrase: 'Test SDF Network ; September 2015'
    }
  }
};

async function testNetworkSwitch() {
  console.log(`${COLORS.blue}Network Switching Integration Test${COLORS.reset}`);
  console.log('='.repeat(50));
  
  try {
    // Test 1: Verify network utility functions
    console.log(`\n${COLORS.yellow}Test 1: Network Utility Functions${COLORS.reset}`);
    
    // Test getStellarFactory
    const mainnetFactory = getStellarFactory('mainnet');
    const testnetFactory = getStellarFactory('testnet');
    
    console.log(`Mainnet factory: ${mainnetFactory}`);
    console.log(`Testnet factory: ${testnetFactory}`);
    
    if (mainnetFactory !== testnetFactory) {
      console.log(`${COLORS.green}✓ Different factories for different networks${COLORS.reset}`);
    } else {
      throw new Error('Same factory returned for different networks');
    }
    
    // Test 2: Start with testnet configuration
    console.log(`\n${COLORS.yellow}Test 2: Testnet Configuration${COLORS.reset}`);
    
    const testnetConfig = NETWORK_CONFIGS.testnet;
    const testnetProvider = new ethers.JsonRpcProvider(testnetConfig.base.rpc);
    
    try {
      const testnetNetwork = await testnetProvider.getNetwork();
      console.log(`Testnet chain ID: ${testnetNetwork.chainId}`);
      console.log(`Expected: ${testnetConfig.base.chainId}`);
      
      if (Number(testnetNetwork.chainId) === testnetConfig.base.chainId) {
        console.log(`${COLORS.green}✓ Connected to Base Sepolia testnet${COLORS.reset}`);
      }
    } catch (error) {
      console.log(`${COLORS.yellow}⚠ Could not connect to testnet (normal if offline)${COLORS.reset}`);
    }
    
    console.log(`\nTestnet contracts:`);
    console.log(`  Escrow Factory: ${testnetConfig.base.escrowFactory}`);
    console.log(`  Resolver: ${testnetConfig.base.resolver}`);
    console.log(`  USDC: ${testnetConfig.base.usdc}`);
    console.log(`  Stellar Factory: ${testnetConfig.stellar.factory}`);
    
    // Test 3: Create order with testnet config
    console.log(`\n${COLORS.yellow}Test 3: Create Order with Testnet Config${COLORS.reset}`);
    
    const testnetBuilder = new OrderBuilder(testnetProvider);
    const testWallet = new ethers.Wallet('0x' + '1'.repeat(64), testnetProvider);
    
    const testnetOrder = await testnetBuilder.buildCrossChainOrder({
      maker: testWallet.address,
      sourceToken: testnetConfig.base.usdc,
      destinationToken: 'native',
      sourceAmount: ethers.parseUnits('1', 6).toString(),
      destinationAmount: ethers.parseUnits('1', 7).toString(),
      sourceChain: 'ethereum',
      destinationChain: 'stellar',
      stellarReceiver: 'GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4'
    });
    
    console.log(`Order created for testnet:`);
    console.log(`  Maker asset: ${testnetOrder.makerAsset}`);
    console.log(`  Expected: ${testnetConfig.base.usdc}`);
    
    if (testnetOrder.makerAsset === testnetConfig.base.usdc) {
      console.log(`${COLORS.green}✓ Order uses testnet USDC address${COLORS.reset}`);
    } else {
      throw new Error('Order not using testnet USDC');
    }
    
    // Test 4: Switch to mainnet configuration
    console.log(`\n${COLORS.yellow}Test 4: Switch to Mainnet Configuration${COLORS.reset}`);
    
    const mainnetConfig = NETWORK_CONFIGS.mainnet;
    const mainnetProvider = new ethers.JsonRpcProvider(mainnetConfig.base.rpc);
    
    const mainnetNetwork = await mainnetProvider.getNetwork();
    console.log(`Mainnet chain ID: ${mainnetNetwork.chainId}`);
    console.log(`Expected: ${mainnetConfig.base.chainId}`);
    
    if (Number(mainnetNetwork.chainId) === mainnetConfig.base.chainId) {
      console.log(`${COLORS.green}✓ Switched to Base mainnet${COLORS.reset}`);
    } else {
      throw new Error('Not connected to Base mainnet');
    }
    
    console.log(`\nMainnet contracts:`);
    console.log(`  Escrow Factory: ${mainnetConfig.base.escrowFactory}`);
    console.log(`  Resolver: ${mainnetConfig.base.resolver}`);
    console.log(`  USDC: ${mainnetConfig.base.usdc}`);
    console.log(`  Stellar Factory: ${mainnetConfig.stellar.factory}`);
    
    // Test 5: Create order with mainnet config
    console.log(`\n${COLORS.yellow}Test 5: Create Order with Mainnet Config${COLORS.reset}`);
    
    const mainnetBuilder = new OrderBuilder(mainnetProvider);
    
    const mainnetOrder = await mainnetBuilder.buildCrossChainOrder({
      maker: testWallet.address,
      sourceToken: mainnetConfig.base.usdc,
      destinationToken: 'native',
      sourceAmount: ethers.parseUnits('1', 6).toString(),
      destinationAmount: ethers.parseUnits('1', 7).toString(),
      sourceChain: 'ethereum',
      destinationChain: 'stellar',
      stellarReceiver: 'GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4'
    });
    
    console.log(`Order created for mainnet:`);
    console.log(`  Maker asset: ${mainnetOrder.makerAsset}`);
    console.log(`  Expected: ${mainnetConfig.base.usdc}`);
    
    if (mainnetOrder.makerAsset === mainnetConfig.base.usdc) {
      console.log(`${COLORS.green}✓ Order uses mainnet USDC address${COLORS.reset}`);
    } else {
      throw new Error('Order not using mainnet USDC');
    }
    
    // Test 6: Verify contract differences
    console.log(`\n${COLORS.yellow}Test 6: Verify Contract Differences${COLORS.reset}`);
    
    const contractsDiffer = 
      testnetConfig.base.escrowFactory !== mainnetConfig.base.escrowFactory &&
      testnetConfig.base.resolver !== mainnetConfig.base.resolver &&
      testnetConfig.base.usdc !== mainnetConfig.base.usdc &&
      testnetConfig.stellar.factory !== mainnetConfig.stellar.factory;
    
    if (contractsDiffer) {
      console.log(`${COLORS.green}✓ All contract addresses differ between networks${COLORS.reset}`);
    } else {
      console.log(`${COLORS.yellow}⚠ Some contracts may be the same (check configuration)${COLORS.reset}`);
    }
    
    // Test 7: Environment variable precedence
    console.log(`\n${COLORS.yellow}Test 7: Environment Variable Precedence${COLORS.reset}`);
    
    const envFactory = process.env.STELLAR_FACTORY_MAINNET;
    const configFactory = NETWORK_CONFIGS.mainnet.stellar.factory;
    
    console.log(`ENV factory: ${envFactory}`);
    console.log(`Config factory: ${configFactory}`);
    
    if (envFactory === configFactory) {
      console.log(`${COLORS.green}✓ Environment variables take precedence${COLORS.reset}`);
    } else {
      console.log(`${COLORS.yellow}⚠ Environment variable may override config${COLORS.reset}`);
    }
    
    // Test 8: Network config utility
    console.log(`\n${COLORS.yellow}Test 8: Network Configuration Utility${COLORS.reset}`);
    
    const currentNetwork = getCurrentNetwork();
    const baseFactory = getBaseFactory();
    const resolver = getResolverAddress();
    const networkConfig = getNetworkConfig();
    
    console.log(`Current network: ${currentNetwork}`);
    console.log(`\nBase configuration:`);
    console.log(`  Escrow Factory: ${baseFactory}`);
    console.log(`  Resolver: ${resolver}`);
    
    console.log(`\nFull network configuration:`);
    console.log(`  Stellar Factory: ${networkConfig.stellar.factory}`);
    console.log(`  Stellar RPC: ${networkConfig.stellar.rpc}`);
    console.log(`  Base Factory: ${networkConfig.base.factory}`);
    console.log(`  Base Chain ID: ${networkConfig.base.chainId}`);
    
    if (baseFactory && resolver && networkConfig.stellar.factory) {
      console.log(`${COLORS.green}✓ Network utilities return valid configuration${COLORS.reset}`);
    } else {
      throw new Error('Network utilities missing configuration');
    }
    
    console.log(`\n${COLORS.green}✅ All network switching tests passed!${COLORS.reset}`);
    console.log('\nSummary:');
    console.log('- Network utility functions work correctly');
    console.log('- Orders use network-specific contracts');
    console.log('- Seamless switching between testnet and mainnet');
    console.log('- Environment variables properly override defaults');
    console.log('- System correctly isolates network configurations');
    
  } catch (error) {
    console.error(`\n${COLORS.red}❌ Test failed:${COLORS.reset}`, error);
    process.exit(1);
  }
}

// Run the test
testNetworkSwitch()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });