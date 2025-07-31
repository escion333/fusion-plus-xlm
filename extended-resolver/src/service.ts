import express from 'express';
import cors from 'cors';
import { CrossChainCoordinator } from './CrossChainCoordinator';
import { STELLAR_CHAIN_ID } from './config';

const app = express();
const port = process.env.PORT || 3003; // Different port from proxy

// Middleware
app.use(cors());
app.use(express.json());

// Initialize coordinator
const coordinator = new CrossChainCoordinator({
  evmChains: [
    {
      chainId: 1,
      rpc: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
      resolverAddress: process.env.ETHEREUM_RESOLVER || '0x1234567890123456789012345678901234567890'
    }
  ],
  stellar: {
    rpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    resolverContractId: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
    network: 'PUBLIC'
  }
});

// Order tracking
const orders = new Map<string, any>();

// API Routes
app.post('/api/orders/create', async (req, res) => {
  try {
    const { order, signature, srcChainId, dstChainId } = req.body;
    
    // Generate order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store order
    orders.set(orderId, {
      status: 'pending',
      order,
      created: new Date().toISOString()
    });
    
    // Process asynchronously
    processOrder(orderId, order, signature, srcChainId, dstChainId);
    
    res.json({
      success: true,
      orderId,
      message: 'Order created and processing'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/orders/:orderId/status', (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  res.json({
    success: true,
    orderId,
    status: order.status,
    details: order
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Extended Resolver Service',
    chains: ['Ethereum', 'Stellar'],
    stellarContract: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU'
  });
});

// Process order asynchronously
async function processOrder(
  orderId: string,
  order: any,
  signature: string,
  srcChainId: number,
  dstChainId: number
) {
  try {
    // Update status
    updateOrderStatus(orderId, 'processing');
    
    // Execute cross-chain swap
    const result = await coordinator.handleCrossChainOrder({
      order,
      signature,
      srcChainId,
      dstChainId
    });
    
    // Update with results
    updateOrderStatus(orderId, 'completed', {
      srcEscrow: result.srcEscrow,
      dstEscrow: result.dstEscrow,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing order:', error);
    updateOrderStatus(orderId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function updateOrderStatus(orderId: string, status: string, details?: any) {
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
    if (details) {
      Object.assign(order, details);
    }
    orders.set(orderId, order);
  }
}

// Start server
app.listen(port, () => {
  console.log(`🚀 Extended Resolver Service running on port ${port}`);
  console.log(`   Health check: http://localhost:${port}/health`);
  console.log(`   Stellar contract: CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU`);
});