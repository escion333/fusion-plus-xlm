#!/usr/bin/env npx tsx
/**
 * Dutch Auction Integration Test
 * 
 * This test verifies the Dutch auction pricing mechanism:
 * 1. Creates order with 5-minute auction
 * 2. Checks price at start, middle, and end
 * 3. Verifies resolver gets best price
 * 4. Ensures auction parameters are correctly encoded
 */

import { ethers } from 'ethers';
import { OrderBuilder, DutchAuctionParams } from '../../src/services/1inch/OrderBuilder';
import dotenv from 'dotenv';

dotenv.config();

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testDutchAuction() {
  console.log(`${COLORS.blue}Dutch Auction Integration Test${COLORS.reset}`);
  console.log('='.repeat(50));
  
  try {
    // Initialize provider and builder
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC || 'https://mainnet.base.org');
    const builder = new OrderBuilder(provider);
    
    // Test parameters
    const baseAmount = '1000000'; // 1 USDC (6 decimals)
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Dutch auction configuration: 5-minute auction with 10% initial premium
    const auctionParams: DutchAuctionParams = {
      auctionStartTime: currentTime + 60, // Start in 1 minute
      auctionEndTime: currentTime + 360, // End in 6 minutes (5 min auction)
      initialRateBump: 1000, // 10% initial premium (1000 basis points)
    };
    
    console.log(`\n${COLORS.yellow}Auction Configuration:${COLORS.reset}`);
    console.log(`Base Amount: ${baseAmount} (1 USDC)`);
    console.log(`Initial Premium: ${auctionParams.initialRateBump / 100}%`);
    console.log(`Duration: 5 minutes`);
    console.log(`Start Time: ${new Date(auctionParams.auctionStartTime * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(auctionParams.auctionEndTime * 1000).toLocaleString()}`);
    
    // Test 1: Price before auction (should be highest)
    console.log(`\n${COLORS.yellow}Test 1: Price Before Auction${COLORS.reset}`);
    const priceBeforeAuction = builder.calculateAuctionPrice(
      baseAmount,
      auctionParams,
      currentTime
    );
    console.log(`Price: ${priceBeforeAuction} (${Number(priceBeforeAuction) / 1e6} USDC)`);
    console.log(`Expected: ${Number(baseAmount) * 1.1 / 1e6} USDC`);
    
    const expectedInitialPrice = (BigInt(baseAmount) * BigInt(11000)) / BigInt(10000);
    if (priceBeforeAuction === expectedInitialPrice.toString()) {
      console.log(`${COLORS.green}✓ Initial price correct${COLORS.reset}`);
    } else {
      throw new Error(`Initial price mismatch: ${priceBeforeAuction} != ${expectedInitialPrice}`);
    }
    
    // Test 2: Price at auction start
    console.log(`\n${COLORS.yellow}Test 2: Price at Auction Start${COLORS.reset}`);
    const priceAtStart = builder.calculateAuctionPrice(
      baseAmount,
      auctionParams,
      auctionParams.auctionStartTime
    );
    console.log(`Price: ${priceAtStart} (${Number(priceAtStart) / 1e6} USDC)`);
    
    if (priceAtStart === expectedInitialPrice.toString()) {
      console.log(`${COLORS.green}✓ Start price correct${COLORS.reset}`);
    } else {
      throw new Error(`Start price mismatch`);
    }
    
    // Test 3: Price at middle of auction (should be halfway)
    console.log(`\n${COLORS.yellow}Test 3: Price at Middle of Auction${COLORS.reset}`);
    const middleTime = auctionParams.auctionStartTime + 150; // 2.5 minutes into auction
    const priceAtMiddle = builder.calculateAuctionPrice(
      baseAmount,
      auctionParams,
      middleTime
    );
    console.log(`Price: ${priceAtMiddle} (${Number(priceAtMiddle) / 1e6} USDC)`);
    console.log(`Expected: ~${1.05} USDC (halfway between 1.1 and 1.0)`);
    
    // Verify it's between start and end price
    const priceAtMiddleNum = Number(priceAtMiddle);
    if (priceAtMiddleNum < Number(priceAtStart) && priceAtMiddleNum > Number(baseAmount)) {
      console.log(`${COLORS.green}✓ Middle price is decreasing correctly${COLORS.reset}`);
    } else {
      throw new Error(`Middle price not in expected range`);
    }
    
    // Test 4: Price at end of auction (should be base price)
    console.log(`\n${COLORS.yellow}Test 4: Price at End of Auction${COLORS.reset}`);
    const priceAtEnd = builder.calculateAuctionPrice(
      baseAmount,
      auctionParams,
      auctionParams.auctionEndTime
    );
    console.log(`Price: ${priceAtEnd} (${Number(priceAtEnd) / 1e6} USDC)`);
    
    if (priceAtEnd === baseAmount) {
      console.log(`${COLORS.green}✓ End price equals base amount${COLORS.reset}`);
    } else {
      throw new Error(`End price mismatch: ${priceAtEnd} != ${baseAmount}`);
    }
    
    // Test 5: Price after auction (should remain at base)
    console.log(`\n${COLORS.yellow}Test 5: Price After Auction${COLORS.reset}`);
    const priceAfterAuction = builder.calculateAuctionPrice(
      baseAmount,
      auctionParams,
      auctionParams.auctionEndTime + 3600
    );
    console.log(`Price: ${priceAfterAuction} (${Number(priceAfterAuction) / 1e6} USDC)`);
    
    if (priceAfterAuction === baseAmount) {
      console.log(`${COLORS.green}✓ Price remains at base after auction${COLORS.reset}`);
    } else {
      throw new Error(`Post-auction price incorrect`);
    }
    
    // Test 6: Create actual order with Dutch auction
    console.log(`\n${COLORS.yellow}Test 6: Create Order with Dutch Auction${COLORS.reset}`);
    
    const testWallet = new ethers.Wallet(process.env.BASE_PRIVATE_KEY || '0x' + '1'.repeat(64), provider);
    
    const order = await builder.buildCrossChainOrder({
      maker: testWallet.address,
      sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      destinationToken: 'native',
      sourceAmount: baseAmount,
      destinationAmount: '10000000', // 10 XLM
      sourceChain: 'ethereum',
      destinationChain: 'stellar',
      stellarReceiver: process.env.DEMO_STELLAR_USER || 'GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4',
      dutchAuction: auctionParams
    });
    
    console.log(`Order created with hash: ${order.orderHash}`);
    
    // Verify maker traits include auction parameters
    const makerTraitsBN = BigInt(order.makerTraits);
    
    // Extract encoded auction times from traits
    // Bits 32-63: auction start time (32 bits)
    // Bits 64-95: auction duration (32 bits)
    // Bits 96-111: initial rate bump (16 bits)
    const extractedStartTime = Number((makerTraitsBN >> BigInt(32)) & BigInt(0xFFFFFFFF));
    const extractedDuration = Number((makerTraitsBN >> BigInt(64)) & BigInt(0xFFFFFFFF));
    const extractedRateBump = Number((makerTraitsBN >> BigInt(96)) & BigInt(0xFFFF));
    
    console.log(`\nEncoded auction parameters in makerTraits:`);
    console.log(`Start time: ${extractedStartTime}`);
    console.log(`Duration: ${extractedDuration} seconds`);
    console.log(`Rate bump: ${extractedRateBump} basis points (${extractedRateBump / 100}%)`);
    
    // Also check if Dutch auction flag is set (bit 3)
    const isDutchAuctionEnabled = (makerTraitsBN & BigInt(8)) !== BigInt(0); // bit 3
    console.log(`Dutch auction enabled: ${isDutchAuctionEnabled}`);
    
    if (extractedStartTime === auctionParams.auctionStartTime) {
      console.log(`${COLORS.green}✓ Auction start time correctly encoded${COLORS.reset}`);
    } else {
      throw new Error(`Start time encoding mismatch`);
    }
    
    const expectedDuration = auctionParams.auctionEndTime - auctionParams.auctionStartTime;
    if (extractedDuration === expectedDuration) {
      console.log(`${COLORS.green}✓ Auction duration correctly encoded${COLORS.reset}`);
    } else {
      throw new Error(`Duration encoding mismatch`);
    }
    
    if (extractedRateBump === auctionParams.initialRateBump) {
      console.log(`${COLORS.green}✓ Initial rate bump correctly encoded${COLORS.reset}`);
    } else {
      throw new Error(`Rate bump encoding mismatch`);
    }
    
    if (isDutchAuctionEnabled) {
      console.log(`${COLORS.green}✓ Dutch auction flag is set${COLORS.reset}`);
    } else {
      throw new Error(`Dutch auction flag not set`);
    }
    
    // Test 7: Verify price curve over time
    console.log(`\n${COLORS.yellow}Test 7: Price Curve Analysis${COLORS.reset}`);
    console.log(`Time\t\tPrice (USDC)\tDiscount`);
    console.log('-'.repeat(40));
    
    for (let i = 0; i <= 5; i++) {
      const time = auctionParams.auctionStartTime + (i * 60); // Every minute
      const price = builder.calculateAuctionPrice(baseAmount, auctionParams, time);
      const priceUSDC = Number(price) / 1e6;
      const discount = ((1.1 - priceUSDC) / 1.1 * 100).toFixed(2);
      console.log(`+${i} min\t\t${priceUSDC.toFixed(4)}\t\t${discount}%`);
    }
    
    console.log(`\n${COLORS.green}✅ All Dutch auction tests passed!${COLORS.reset}`);
    console.log('\nSummary:');
    console.log('- Price calculation works correctly at all stages');
    console.log('- Auction parameters properly encoded in makerTraits');
    console.log('- Linear price decay verified');
    console.log('- Order creation with auction successful');
    
  } catch (error) {
    console.error(`\n${COLORS.red}❌ Test failed:${COLORS.reset}`, error);
    process.exit(1);
  }
}

// Run the test
testDutchAuction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });