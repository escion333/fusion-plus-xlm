import express from 'express';
import cors from 'cors';
import { ResolverService, ResolverConfig } from './ResolverService';
import { logger } from './utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Build configuration
const config: ResolverConfig = {
  chains: (process.env.RESOLVER_CHAINS || 'ethereum,stellar').split(',') as any,
  polling: {
    interval: parseInt(process.env.RESOLVER_POLLING_INTERVAL || '5000', 10),
    enabled: process.env.RESOLVER_POLLING_ENABLED !== 'false',
  },
  resolver: {
    address: process.env.RESOLVER_ADDRESS || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: process.env.RESOLVER_PRIVATE_KEY || 'demo_key',
  },
  database: {
    connectionString: process.env.DATABASE_URL || 'inmemory',
  },
};

// Create resolver instance
const resolver = new ResolverService(config);

// Track orders
const orders = new Map<string, any>();

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Fusion+ Resolver',
    chains: config.chains,
    stellarContract: process.env.STELLAR_CONTRACT_ID,
  });
});

app.get('/status', async (req, res) => {
  try {
    const status = resolver.getStatus();
    res.json({
      ...status,
      orders: orders.size,
      stellarContract: process.env.STELLAR_CONTRACT_ID,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Create order endpoint
app.post('/api/orders', async (req, res) => {
  try {
    const { srcChain, dstChain, amount, token, stellarReceiver } = req.body;
    
    // Generate order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order object
    const order = {
      id: orderId,
      srcChain,
      dstChain,
      amount,
      token,
      stellarReceiver,
      status: 'pending',
      created: new Date().toISOString(),
    };
    
    // Store order
    orders.set(orderId, order);
    
    // In production, this would trigger the resolver to monitor for the order
    // For demo, we'll simulate the flow
    if (process.env.MOCK_MODE === 'true') {
      setTimeout(() => {
        order.status = 'processing';
        order.srcEscrow = '0x' + Math.random().toString(16).substr(2, 40);
        order.dstEscrow = process.env.STELLAR_CONTRACT_ID;
      }, 2000);
      
      setTimeout(() => {
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
      }, 5000);
    }
    
    res.json({
      success: true,
      orderId,
      order,
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get order status
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
    });
  }
  
  res.json({
    success: true,
    order,
  });
});

// Start services
async function start() {
  try {
    // Start resolver service
    await resolver.start();
    logger.info('Resolver service started');
    
    // Start API server
    app.listen(PORT, () => {
      console.log(`🚀 Resolver API running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   Status: http://localhost:${PORT}/status`);
      console.log(`   Stellar Contract: ${process.env.STELLAR_CONTRACT_ID}`);
    });
  } catch (error) {
    logger.error('Failed to start services:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await resolver.stop();
  process.exit(0);
});

// Start everything
start().catch(console.error);