import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { QuoteRequest, SwapRequest, ApiError, QuoteParams, SwapParams } from './types';
import { validateQuoteParams, validateSwapParams, ValidationError, buildSafeUrl } from './validators';

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

// Get chain ID from environment or default to Ethereum mainnet
const CHAIN_ID = process.env.CHAIN_ID || '1';
const API_VERSION = 'v6.0';

// Rate limiting configuration
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const error: ApiError = {
        error: 'Rate Limit Exceeded',
        statusCode: 429,
        description: message
      };
      res.status(429).json(error);
    }
  });
};

// Different rate limits for different endpoints
const quoteLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 requests per minute
  'Too many quote requests. Please try again later.'
);

const swapLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 swaps per minute
  'Too many swap requests. Please try again later.'
);

const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per 15 minutes
  'Too many requests. Please try again later.'
);

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ValidationError) {
    const error: ApiError = {
      error: 'Validation Error',
      statusCode: 400,
      description: err.message
    };
    return res.status(400).json(error);
  }
  
  console.error('Proxy error:', err);
  const error: ApiError = {
    error: 'Internal Server Error',
    statusCode: 500,
    description: 'An unexpected error occurred'
  };
  res.status(500).json(error);
};

// Validation middleware for quote endpoints
const validateQuote = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateQuoteParams(req.query as Partial<QuoteParams>);
    (req as QuoteRequest).query = validated;
    next();
  } catch (err) {
    next(err);
  }
};

// Validation middleware for swap endpoints
const validateSwap = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateSwapParams(req.query as Partial<SwapParams>);
    (req as SwapRequest).query = validated;
    next();
  } catch (err) {
    next(err);
  }
};

// 1inch API proxy configuration for swap endpoints
const oneinchApiProxy = createProxyMiddleware({
  target: 'https://api.1inch.dev',
  changeOrigin: true,
  pathRewrite: (path: string, req: express.Request) => {
    try {
      const url = new URL(`http://dummy${path}`);
      const params = new URLSearchParams(url.search);
      
      // Build safe path based on endpoint
      if (path.includes('/quote')) {
        return `/swap/${API_VERSION}/${CHAIN_ID}/quote?${params.toString()}`;
      }
      if (path.includes('/swap')) {
        return `/swap/${API_VERSION}/${CHAIN_ID}/swap?${params.toString()}`;
      }
      
      // Default path rewrite
      return path.replace('/api/1inch', `/swap/${API_VERSION}/${CHAIN_ID}`);
    } catch (error) {
      console.error('Path rewrite error:', error);
      return path;
    }
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
      
      // Add custom headers
      proxyRes.headers['X-Proxy-By'] = '1inch-stellar-proxy';
    },
    error: (err, req, res) => {
      console.error('[1inch Proxy] Error:', err);
      (res as any).status(500).json({ error: 'Proxy error', message: err.message });
    },
  },
});

// Common path rewriting logic
function rewriteFusionPath(path: string): string {
  try {
    const url = new URL(`http://dummy${path}`);
    const params = new URLSearchParams(url.search);
    
    // For Fusion+, ensure fusion mode is enabled
    if (path.includes('/quote')) {
      if (!params.has('includeProtocols')) {
        params.set('includeProtocols', 'ONEINCH_FUSION');
      }
      return `/swap/${API_VERSION}/${CHAIN_ID}/quote?${params.toString()}`;
    }
    
    if (path.includes('/orders/create') || path.includes('/swap')) {
      return `/swap/${API_VERSION}/${CHAIN_ID}/swap`;
    }
    
    return path.replace('/api/fusion', `/swap/${API_VERSION}/${CHAIN_ID}`);
  } catch (error) {
    console.error('Fusion path rewrite error:', error);
    return path;
  }
}

// 1inch Fusion+ API proxy
const fusionApiProxy = createProxyMiddleware({
  target: 'https://api.1inch.dev',
  changeOrigin: true,
  pathRewrite: rewriteFusionPath,
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Add API key if available
      if (process.env.ONEINCH_API_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${process.env.ONEINCH_API_KEY}`);
      }
      
      // Add Fusion-specific headers
      proxyReq.setHeader('X-1inch-Mode', 'fusion');
      
      // Log request
      console.log(`[Fusion Proxy] ${(req as any).method} ${(req as any).path} -> ${proxyReq.path}`);
    },
    proxyRes: (proxyRes, req, res) => {
      console.log(`[Fusion Proxy] Response: ${proxyRes.statusCode}`);
    },
    error: (err, req, res) => {
      console.error('[Fusion Proxy] Error:', err);
      (res as any).status(500).json({ error: 'Fusion proxy error', message: err.message });
    },
  },
});

// Mock endpoints for demo (when no API key is available)
// Store mock orders in memory for demo
const mockOrders = new Map<string, any>();

app.get('/api/mock/fusion/orders/active', (req: Request, res: Response) => {
  // Return mock active orders
  const orders = Array.from(mockOrders.values()).filter(order => 
    order.status !== 'completed' && order.status !== 'failed'
  );
  
  res.json({
    orders: [
      ...orders,
      {
        orderHash: '0x' + Math.random().toString(16).substring(2, 66),
        status: 'active',
        fromToken: 'ETH',
        toToken: 'USDC',
        fromAmount: '1000000000000000000',
        toAmount: '3000000000',
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
      {
        orderHash: '0x' + Math.random().toString(16).substring(2, 66),
        status: 'filled',
        fromToken: 'USDC',
        toToken: 'DAI',
        fromAmount: '1000000000',
        toAmount: '999500000000000000000',
        createdAt: new Date(Date.now() - 600000).toISOString(),
      },
    ],
  });
});

app.post('/api/mock/fusion/orders/create', express.json(), (req: Request, res: Response) => {
  // Return mock created order
  const order = req.body;
  const orderHash = '0x' + Math.random().toString(16).substring(2, 66);
  const createdOrder = {
    ...order,
    orderHash,
    status: 'created',
    createdAt: new Date().toISOString(),
    progress: 'creating',
  };
  
  // Store order for status tracking
  mockOrders.set(orderHash, createdOrder);
  
  // Simulate order progression
  setTimeout(() => {
    const order = mockOrders.get(orderHash);
    if (order) {
      order.status = 'pending';
      order.progress = 'pending';
      mockOrders.set(orderHash, order);
    }
  }, 2000);
  
  setTimeout(() => {
    const order = mockOrders.get(orderHash);
    if (order) {
      order.status = 'claimed';
      order.progress = 'processing';
      order.resolver = '0x' + Math.random().toString(16).substring(2, 40);
      mockOrders.set(orderHash, order);
    }
  }, 5000);
  
  setTimeout(() => {
    const order = mockOrders.get(orderHash);
    if (order) {
      order.status = 'executing';
      order.progress = 'processing';
      order.escrowAddresses = {
        source: '0x' + Math.random().toString(16).substring(2, 40),
        destination: '0x' + Math.random().toString(16).substring(2, 40),
      };
      mockOrders.set(orderHash, order);
    }
  }, 8000);
  
  setTimeout(() => {
    const order = mockOrders.get(orderHash);
    if (order) {
      order.status = 'completed';
      order.progress = 'completed';
      order.completedAt = new Date().toISOString();
      order.txHashes = {
        source: '0x' + Math.random().toString(16).substring(2, 64),
        destination: '0x' + Math.random().toString(16).substring(2, 64),
      };
      mockOrders.set(orderHash, order);
    }
  }, 15000);
  
  res.json({
    success: true,
    order: createdOrder,
  });
});

// Get order status endpoint
app.get('/api/mock/fusion/orders/:orderHash', (req: Request, res: Response) => {
  const { orderHash } = req.params;
  const order = mockOrders.get(orderHash);
  
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  res.json({ order });
});

// Add handler for direct fusion/orders/create endpoint
app.post('/api/fusion/orders/create', express.json(), (req: Request, res: Response) => {
  // In production, this would forward to real 1inch API
  // For now, forward to mock endpoint
  req.url = '/api/mock/fusion/orders/create';
  app.handle(req, res);
});

// Add handler for getting order status (live mode)
app.get('/api/fusion/orders/:orderHash', (req: Request, res: Response) => {
  // In production, this would query real 1inch API
  // For now, try to get from mock orders
  const { orderHash } = req.params;
  const order = mockOrders.get(orderHash);
  
  if (order) {
    res.json({ order });
  } else {
    res.status(404).json({ error: 'Order not found in live mode' });
  }
});

app.get('/api/mock/quote', (req: Request, res: Response) => {
  try {
    // Return mock quote without validation for demo
    const { src, dst, amount } = req.query;
    
    // Convert user-friendly amount to wei/smallest unit
    const amountStr = amount as string || '1000000000000000000';
    const srcToken = src as string || '0x0000000000000000000000000000000000000000';
    const dstToken = dst as string || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    
    res.json({
      fromToken: {
        symbol: srcToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'TOKEN',
        name: srcToken === '0x0000000000000000000000000000000000000000' ? 'Ethereum' : 'Token',
        decimals: 18,
        address: srcToken,
      },
      toToken: {
        symbol: dstToken === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' ? 'USDC' : 'TOKEN',
        name: dstToken === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' ? 'USD Coin' : 'Token',
        decimals: 6,
        address: dstToken,
      },
      fromAmount: amountStr,
      toAmount: (() => {
        // Mock rates for different token pairs
        const amount = parseFloat(amountStr);
        
        // Determine source token decimals
        const isSourceETH = srcToken === '0x0000000000000000000000000000000000000000' || 
                           srcToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const isDestUSDC = dstToken === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        
        if (isSourceETH && isDestUSDC) {
          // ETH to USDC: 1 ETH = 3000 USDC
          return Math.floor(amount * 3000 / 1e18 * 1e6).toString();
        } else if (!isSourceETH && isDestUSDC) {
          // USDC to USDC (cross-chain): 1:1 with small fee
          return Math.floor(amount * 0.998).toString(); // 0.2% fee
        } else {
          // Default: same amount (for testing)
          return amountStr;
        }
      })(),
      protocols: [
        [
          {
            name: 'ONEINCH_FUSION',
            part: 100,
          }
        ]
      ],
      estimatedGas: '150000',
      isMockData: true,
    });
  } catch (error) {
    console.error('Mock quote error:', error);
    res.status(500).json({ error: 'Mock quote generation failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Apply rate limiting to all routes
app.use(generalLimiter);

// Mount proxy routes with validation and specific rate limits
app.use('/api/1inch/quote', quoteLimiter, validateQuote, oneinchApiProxy);
app.use('/api/1inch/swap', swapLimiter, validateSwap, oneinchApiProxy);
app.use('/api/1inch', oneinchApiProxy);

app.use('/api/fusion/quote', quoteLimiter, validateQuote, fusionApiProxy);
app.use('/api/fusion/swap', swapLimiter, validateSwap, fusionApiProxy);
app.use('/api/fusion', fusionApiProxy);

// Apply error handler
app.use(errorHandler);

// Start server with error handling
const server = app.listen(PORT, () => {
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
  
  // Log environment
  console.log('');
  console.log('📋 Configuration:');
  console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  - CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`  - Log Level: ${process.env.LOG_LEVEL || 'info'}`);
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`);
  } else if (error.code === 'EACCES') {
    console.error(`❌ Permission denied to use port ${PORT}. Try a port number above 1024.`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📭 SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📭 SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;