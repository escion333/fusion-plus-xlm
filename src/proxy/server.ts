import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3002;

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '1inch-proxy' });
});

// 1inch API proxy configuration
const oneinchApiProxy = createProxyMiddleware({
  target: 'https://api.1inch.dev',
  changeOrigin: true,
  pathRewrite: {
    '^/api/1inch': '', // Remove /api/1inch prefix
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Add API key if available
      if (process.env.ONEINCH_API_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${process.env.ONEINCH_API_KEY}`);
      }
      
      // Log request for debugging
      console.log(`[1inch Proxy] ${(req as any).method} ${(req as any).path} -> ${proxyReq.path}`);
    },
    proxyRes: (proxyRes, req, res) => {
      // Log response status
      console.log(`[1inch Proxy] Response: ${proxyRes.statusCode}`);
    },
    error: (err, req, res) => {
      console.error('[1inch Proxy] Error:', err);
      (res as any).status(500).json({ error: 'Proxy error', message: err.message });
    },
  },
});

// 1inch Fusion API proxy
const fusionApiProxy = createProxyMiddleware({
  target: 'https://fusion.1inch.io',
  changeOrigin: true,
  pathRewrite: {
    '^/api/fusion': '', // Remove /api/fusion prefix
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Add API key if available
      if (process.env.ONEINCH_API_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${process.env.ONEINCH_API_KEY}`);
      }
      
      // Log request for debugging
      console.log(`[Fusion Proxy] ${(req as any).method} ${(req as any).path} -> ${proxyReq.path}`);
    },
    proxyRes: (proxyRes, req, res) => {
      // Log response status
      console.log(`[Fusion Proxy] Response: ${proxyRes.statusCode}`);
    },
    error: (err, req, res) => {
      console.error('[Fusion Proxy] Error:', err);
      (res as any).status(500).json({ error: 'Proxy error', message: err.message });
    },
  },
});

// Mock endpoints for demo (when no API key is available)
app.get('/api/mock/fusion/orders/active', (req, res) => {
  // Return mock active orders
  res.json({
    orders: [
      {
        orderHash: '0x' + '1'.repeat(64),
        maker: '0x' + '2'.repeat(40),
        makerAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        makingAmount: '1000000000', // 1000 USDC
        takingAmount: '500000000000000000', // 0.5 ETH
        deadline: Math.floor(Date.now() / 1000) + 3600,
        auctionStartTime: Math.floor(Date.now() / 1000),
        auctionEndTime: Math.floor(Date.now() / 1000) + 600,
        initialRateBump: 0,
        status: 'open',
      },
    ],
  });
});

app.post('/api/mock/fusion/orders/create', express.json(), (req, res) => {
  // Return mock created order
  const order = req.body;
  res.json({
    success: true,
    order: {
      ...order,
      orderHash: '0x' + Math.random().toString(16).substr(2, 64),
      status: 'created',
      createdAt: new Date().toISOString(),
    },
  });
});

app.get('/api/mock/quote', (req, res) => {
  // Return mock quote
  const { src, dst, amount } = req.query;
  res.json({
    fromToken: src,
    toToken: dst,
    fromAmount: amount,
    toAmount: (parseInt(amount as string) * 2).toString(), // Mock 2x rate
    protocols: [['UNISWAP_V3']],
    estimatedGas: '150000',
  });
});

// Mount proxy routes
app.use('/api/1inch', oneinchApiProxy);
app.use('/api/fusion', fusionApiProxy);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 1inch API Proxy Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📍 Endpoints:');
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log(`  - 1inch API: http://localhost:${PORT}/api/1inch/*`);
  console.log(`  - Fusion API: http://localhost:${PORT}/api/fusion/*`);
  console.log(`  - Mock Orders: http://localhost:${PORT}/api/mock/fusion/orders/active`);
  console.log(`  - Mock Create: http://localhost:${PORT}/api/mock/fusion/orders/create`);
  console.log(`  - Mock Quote: http://localhost:${PORT}/api/mock/quote`);
  console.log('');
  
  if (!process.env.ONEINCH_API_KEY) {
    console.log('⚠️  No 1inch API key found. Using mock endpoints for demo.');
    console.log('   Get your API key at: https://portal.1inch.dev');
  } else {
    console.log('✅ 1inch API key configured');
  }
});

export default app;