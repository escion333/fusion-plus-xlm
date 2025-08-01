#!/usr/bin/env tsx

import fetch from 'node-fetch';
import { logger } from '../src/services/resolver/utils/logger';

async function testIntegration() {
  logger.info('🧪 Testing Extended Resolver Integration\n');

  const services = [
    { name: 'Frontend', url: 'http://localhost:3000', expected: 'html' },
    { name: 'API Proxy', url: 'http://localhost:3002/health', expected: 'json' },
    { name: 'Extended Resolver', url: 'http://localhost:3003/health', expected: 'json' },
  ];

  // Test service health
  logger.info('1️⃣ Checking service health...');
  for (const service of services) {
    try {
      const response = await fetch(service.url);
      if (response.ok) {
        logger.info(`✅ ${service.name}: OK`);
      } else {
        logger.error(`❌ ${service.name}: Failed (${response.status})`);
      }
    } catch (error) {
      logger.error(`❌ ${service.name}: Not running`);
    }
  }

  // Test cross-chain order creation
  logger.info('\n2️⃣ Testing cross-chain order creation...');
  try {
    const orderPayload = {
      order: {
        maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        makerAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
        takerAsset: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', // USDC on Stellar
        makingAmount: '1000000000', // 1000 USDC
        takingAmount: '990000000',  // 990 USDC
        stellarReceiver: 'GBFZR4HFQPZQHGKZYQSV3WHJRKJPXNCBNCNVWHJSZUQJEJDZVIHDTEST',
      },
      srcChainId: 1,    // Ethereum
      dstChainId: 1001, // Stellar
    };

    const response = await fetch('http://localhost:3003/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    if (response.ok) {
      const result = await response.json();
      logger.info('✅ Order created successfully:', result);
    } else {
      logger.error('❌ Order creation failed:', await response.text());
    }
  } catch (error) {
    logger.error('❌ Failed to test order creation:', error);
  }

  // Test quote functionality
  logger.info('\n3️⃣ Testing quote functionality...');
  try {
    const quoteParams = new URLSearchParams({
      src: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      dst: '0x0000000000000000000000000000000000000000', // ETH
      amount: '1000000000', // 1000 USDC
    });

    const response = await fetch(`http://localhost:3002/api/mock/quote?${quoteParams}`);
    if (response.ok) {
      const quote = await response.json();
      logger.info('✅ Quote received:', {
        from: `${quote.fromAmount} ${quote.fromToken.symbol}`,
        to: `${quote.toAmount} ${quote.toToken.symbol}`,
      });
    } else {
      logger.error('❌ Quote failed:', await response.text());
    }
  } catch (error) {
    logger.error('❌ Failed to test quote:', error);
  }

  logger.info('\n🏁 Integration test complete!');
}

// Run the test
testIntegration().catch(console.error);