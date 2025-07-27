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
app.get('/api/mock/fusion/orders/active', (req: Request, res: Response) => {
  // Return mock active orders
  res.json({
    orders: [
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
  res.json({
    success: true,
    order: {
      ...order,
      orderHash: '0x' + Math.random().toString(16).substring(2, 66),
      status: 'created',
      createdAt: new Date().toISOString(),
    },
  });
});

app.get('/api/mock/quote', validateQuote, (req: QuoteRequest, res: Response) => {
  // Return mock quote
  const { src, dst, amount } = req.query;
  res.json({
    fromToken: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      address: src as string,
    },
    toToken: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: dst as string,
    },
    fromAmount: amount as string,
    toAmount: (parseInt(amount as string) * 2).toString(), // Mock 2x rate
    protocols: [
      [
        {
          name: 'ONEINCH_FUSION',
          part: 100,
        }
      ]
    ],
    estimatedGas: '150000',
  });
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