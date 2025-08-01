import express, { Request, Response } from 'express';
import { ethers } from 'ethers';
import * as StellarSdk from 'stellar-sdk';
import { ExtendedRelayer, CrossChainOrder } from '../../../extended-resolver/src/ExtendedRelayer';
import { STELLAR_CHAIN_ID } from '../../../extended-resolver/src/config';
import { MockResolver } from '../1inch/MockResolver';
import { logger } from '../resolver/utils/logger';
import { MainnetHTLCHandler } from './mainnet-htlc-handler';

const app = express();
const PORT = process.env.EXTENDED_RESOLVER_PORT || 3003;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialize services
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com');
// Use a valid demo private key (32 bytes hex)
const privateKey = process.env.RESOLVER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const signer = new ethers.Wallet(privateKey, provider);
const extendedRelayer = new ExtendedRelayer();
const mockResolver = new MockResolver(provider, signer);
const mainnetHTLC = new MainnetHTLCHandler();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'extended-resolver',
    stellar: 'ready',
    ethereum: 'ready'
  });
});

// Create order endpoint
app.post('/api/orders/create', async (req: Request, res: Response) => {
  try {
    const { order, srcChainId, dstChainId } = req.body;
    
    logger.info('Creating cross-chain order', {
      srcChain: srcChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
      dstChain: dstChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
      orderHash: order.orderHash || 'pending'
    });

    // Generate order hash
    const orderHash = '0x' + ethers.randomBytes(32).toString();
    
    // Create cross-chain order
    const crossChainOrder: CrossChainOrder = {
      srcChainId,
      dstChainId,
      orderHash,
      maker: order.maker,
      taker: order.taker || await signer.getAddress(),
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: BigInt(order.makingAmount || order.makerAmount),
      takingAmount: BigInt(order.takingAmount || order.takerAmount),
      hashLock: order.hashLock || order.hashlockSecret || ethers.keccak256(ethers.randomBytes(32)),
    };

    // Add to mock resolver for monitoring
    mockResolver.addOrder({
      orderHash,
      maker: crossChainOrder.maker,
      makerAsset: crossChainOrder.makerAsset,
      takerAsset: crossChainOrder.takerAsset,
      makingAmount: crossChainOrder.makingAmount.toString(),
      takingAmount: crossChainOrder.takingAmount.toString(),
      deadline: Math.floor(Date.now() / 1000) + 3600,
      status: 'open',
      auctionStartTime: Math.floor(Date.now() / 1000),
      auctionEndTime: Math.floor(Date.now() / 1000) + 600,
      initialRateBump: 0,
      crossChain: {
        enabled: true,
        destinationChain: dstChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
        stellarReceiver: order.stellarReceiver,
        hashlockSecret: crossChainOrder.hashLock,
      },
    });

    // Check if we should use real mainnet HTLC
    if (mainnetHTLC.shouldUseMainnet() && dstChainId === STELLAR_CHAIN_ID) {
      // Use real mainnet HTLC for Stellar destination
      const htlcResult = await mainnetHTLC.handleCrossChainOrder({
        orderId: orderHash,
        srcChain: srcChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
        dstChain: 'stellar',
        maker: crossChainOrder.maker,
        taker: crossChainOrder.taker,
        amount: crossChainOrder.takingAmount.toString(),
        token: order.token || 'XLM',
        stellarReceiver: order.stellarReceiver || crossChainOrder.maker,
      });

      if (htlcResult.success) {
        res.json({
          success: true,
          orderId: orderHash,
          status: 'processing',
          srcChain: srcChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
          dstChain: 'stellar',
          stellarTxHash: htlcResult.transactionHash,
          explorerUrl: htlcResult.explorerUrl,
          escrowAddress: htlcResult.escrowAddress,
        });
      } else {
        res.status(500).json({
          success: false,
          error: htlcResult.error,
        });
      }
    } else {
      // Use mock processing for demo mode
      extendedRelayer.handleOrder(crossChainOrder).catch(error => {
        logger.error('Error processing order:', error);
      });

      res.json({
        success: true,
        orderId: orderHash,
        status: 'processing',
        srcChain: srcChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
        dstChain: dstChainId === STELLAR_CHAIN_ID ? 'stellar' : 'ethereum',
      });
    }

  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get order status
app.get('/api/orders/:orderHash', (req: Request, res: Response) => {
  const { orderHash } = req.params;
  
  // Check mainnet HTLC handler first
  const mainnetStatus = mainnetHTLC.getOrderStatus(orderHash);
  if (mainnetStatus) {
    return res.json({
      order: mainnetStatus,
      source: 'mainnet-htlc',
    });
  }
  
  // Fall back to mock resolver
  const orderStatus = mockResolver.getOrderStatus(orderHash);
  const escrowStatus = mockResolver.getEscrowStatus(orderHash);
  
  if (!orderStatus) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json({
    order: orderStatus,
    escrows: escrowStatus,
    source: 'mock',
  });
});

// Get resolver stats
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = mockResolver.getStats();
  
  res.json({
    ...stats,
    service: 'extended-resolver',
    stellarContract: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
  });
});

// Start monitoring orders
mockResolver.monitorOrders().catch(error => {
  logger.error('Error starting order monitoring:', error);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Extended Resolver Service running on http://localhost:${PORT}`);
  logger.info('');
  logger.info('📍 Endpoints:');
  logger.info(`  - Health: http://localhost:${PORT}/health`);
  logger.info(`  - Create Order: POST http://localhost:${PORT}/api/orders/create`);
  logger.info(`  - Order Status: GET http://localhost:${PORT}/api/orders/:orderHash`);
  logger.info(`  - Stats: GET http://localhost:${PORT}/api/stats`);
  logger.info('');
  logger.info('🌟 Stellar Integration:');
  logger.info(`  - Contract: CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU`);
  logger.info(`  - Network: ${process.env.STELLAR_NETWORK || 'PUBLIC'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;