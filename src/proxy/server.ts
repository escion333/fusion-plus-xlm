import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
// @ts-ignore
import fetch from 'node-fetch';
import { QuoteRequest, SwapRequest, ApiError, QuoteParams, SwapParams } from './types.ts';
import { validateQuoteParams, validateSwapParams, ValidationError, buildSafeUrl } from './validators.ts';
import { handleStellarQuote } from './stellar-quote.ts';

dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3002;

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const API_VERSION = 'v5.2';

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
    // Store validated params in a custom property instead of overwriting query
    (req as any).validatedQuery = validated;
    next();
  } catch (err) {
    next(err);
  }
};

// Validation middleware for swap endpoints
const validateSwap = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateSwapParams(req.query as Partial<SwapParams>);
    // Store validated params in a custom property instead of overwriting query
    (req as any).validatedQuery = validated;
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

// Live mode only - no mock endpoints

// Add handler for fusion/orders/active endpoint
app.get('/api/fusion/orders/active', async (req: Request, res: Response) => {
  try {
    // In production, fetch from 1inch API or resolver service
    if (process.env.NODE_ENV === 'production' && process.env.EXTENDED_RESOLVER_URL) {
      // Fetch active orders from the resolver service
      const resolverUrl = process.env.EXTENDED_RESOLVER_URL;
      const response = await axios.get(`${resolverUrl}/api/orders/active`, {
        headers: {
          'Authorization': `Bearer ${process.env.RESOLVER_API_KEY || ''}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      // Filter for cross-chain orders involving Stellar
      const crossChainOrders = response.data.orders?.filter((order: any) => 
        order.destinationChain === 'stellar' || order.sourceChain === 'stellar'
      ) || [];
      
      res.json({ orders: crossChainOrders });
    } else if (process.env.NODE_ENV === 'development') {
      // Development mode - return mock data
      const mockOrders = [
        {
          orderHash: `0x${Math.random().toString(16).slice(2, 16)}`,
          status: 'active',
          fromToken: 'USDC',
          toToken: 'USDC',
          fromAmount: '100000000',
          toAmount: '100000000',
          fromChain: 'base',
          toChain: 'stellar',
          createdAt: new Date().toISOString(),
          crossChain: {
            enabled: true,
            destinationChain: 'stellar',
            stellarReceiver: process.env.DEMO_STELLAR_USER || 'GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK'
          }
        }
      ];
      res.json({ orders: mockOrders });
    } else {
      // Production without resolver - return empty
      res.json({ orders: [] });
    }
  } catch (error) {
    console.error('Error fetching active orders:', error);
    res.status(500).json({ error: 'Failed to fetch active orders' });
  }
});

// Add handler for direct fusion/orders/create endpoint
app.post('/api/fusion/orders/create', express.json(), async (req: Request, res: Response) => {
  // Check if this is a Stellar cross-chain order
  const order = req.body;
  console.log('Received order:', JSON.stringify(order, null, 2));
  console.log('CrossChain object:', order.crossChain);
  console.log('Has crossChain?', !!order.crossChain);
  console.log('destinationChain:', order.crossChain?.destinationChain);
  console.log('stellarReceiver:', order.crossChain?.stellarReceiver);
  // Check if makerAsset or takerAsset is a Stellar asset (format: "TOKEN:ADDRESS")
  const hasStellarAsset = 
    (order.makerAsset && order.makerAsset.includes(':')) ||
    (order.takerAsset && order.takerAsset.includes(':'));
  
  const isStellarOrder = 
    order.crossChain?.destinationChain === 'stellar' ||
    (order.crossChain?.enabled && order.crossChain?.stellarReceiver) ||
    hasStellarAsset;
  console.log('Is Stellar order?', isStellarOrder, 'Has Stellar asset?', hasStellarAsset);
  
  if (isStellarOrder) {
    try {
      // Forward to our extended resolver service
      const extendedResolverUrl = process.env.EXTENDED_RESOLVER_URL || 'http://localhost:3003';
      console.log('Forwarding to extended resolver:', extendedResolverUrl);
      const response = await fetch(`${extendedResolverUrl}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            ...order,
            makingAmount: order.amount || order.makingAmount,
            takingAmount: order.amount || order.takingAmount,
            makerAsset: order.srcToken || order.makerAsset,
            takerAsset: order.dstToken || order.takerAsset,
          },
          signature: '',
          srcChainId: 1,
          dstChainId: 1001,
        }),
      });
      
      console.log('Extended resolver response status:', response.status);
      
      if (response.ok) {
        const result: any = await response.json();
        console.log('Extended resolver result:', JSON.stringify(result, null, 2));
        // Return the full order object as expected by frontend
        const fullOrder = {
          orderHash: result.orderId,
          status: result.status || 'processing',
          ...order,
          stellarTxHash: result.stellar?.transactionHash || result.stellarTxHash,
          explorerUrl: result.stellar?.explorerUrl || result.explorerUrl,
          escrowAddress: result.stellar?.escrowAddress || result.escrowAddress,
          ethereum: result.ethereum,
          stellar: result.stellar,
        };
        
        // Store the order for status tracking
        stellarOrders.set(result.orderId, fullOrder);
        
        return res.json({
          success: true,
          order: fullOrder,
        });
      } else {
        const errorData = await response.text();
        console.error('Extended resolver failed:', errorData);
        return res.status(500).json({
          success: false,
          error: 'Failed to create order via extended resolver',
        });
      }
    } catch (error) {
      console.error('Extended resolver error:', error);
    }
  }
  
  // For non-Stellar orders, return error
  res.status(400).json({
    success: false,
    error: 'Non-Stellar orders not supported in live mode',
  });
});

// Store real orders created through extended resolver
const stellarOrders = new Map<string, any>();

// Add handler for getting order status (live mode)
app.get('/api/fusion/orders/:orderHash', async (req: Request, res: Response) => {
  const { orderHash } = req.params;
  
  // Check if we have this order stored locally
  const storedOrder = stellarOrders.get(orderHash);
  if (storedOrder) {
    // Return the stored order with updated status
    const mappedOrder = {
      orderHash,
      status: 'processing', // Since escrow was created, it's processing
      progress: 'processing',
      resolver: storedOrder.ethereum?.contractId || storedOrder.resolver || '0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1',
      escrowAddresses: {
        source: storedOrder.ethereum?.contractId || '0x' + Math.random().toString(16).substring(2, 42),
        destination: storedOrder.stellar?.escrowAddress || storedOrder.escrowAddress || 'CCYMPB2LATOMFUUXVKQ3IHEGYU6DSOO6LREZSPG6SW72RCCXMEQAWVRJ',
      },
      txHashes: {
        sourceDeployment: storedOrder.ethereum?.transactionHash,
        destinationDeployment: storedOrder.stellar?.transactionHash || storedOrder.stellarTxHash,
        destinationWithdrawal: storedOrder.stellar?.transactionHash,
      },
    };
    
    res.json({ order: mappedOrder });
    return;
  }
  
  // First check if this might be a Stellar order by checking extended resolver
  try {
    const extendedResolverUrl = process.env.EXTENDED_RESOLVER_URL || 'http://localhost:3003';
    const response = await fetch(`${extendedResolverUrl}/api/orders/${orderHash}`);
    
    if (response.ok) {
      const data: any = await response.json();
      
      // Map extended resolver format to frontend's expected format
      const orderData = data.order || data;
      const mappedOrder = {
        orderHash,
        status: orderData.status,
        progress: orderData.status === 'escrow_created' ? 'processing' : 
                 orderData.status === 'completed' ? 'completed' : 
                 orderData.status === 'failed' ? 'failed' : 'pending',
        resolver: orderData.ethereum?.contractId || '0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1',
        escrowAddresses: {
          source: orderData.ethereum?.contractId || '0x' + Math.random().toString(16).substring(2, 42),
          destination: orderData.stellar?.escrowAddress || 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
        },
        txHashes: {
          sourceDeployment: orderData.ethereum?.transactionHash,
          destinationDeployment: orderData.stellar?.transactionHash,
          destinationWithdrawal: orderData.stellar?.transactionHash, // Show Stellar tx as withdrawal
        },
      };
      
      res.json({ order: mappedOrder });
      return;
    }
  } catch (error) {
    console.error('Extended resolver check failed:', error);
  }
  
  // Order not found
  res.status(404).json({ error: 'Order not found' });
});

// Removed mock quote endpoint - use real API only

// Apply rate limiting to all routes
app.use(generalLimiter);

// Custom handler for quotes that checks for Stellar tokens
app.get('/api/1inch/quote', quoteLimiter, (req: Request, res: Response, next: NextFunction) => {
  const { src, dst } = req.query;
  
  // Check if this involves Stellar tokens
  const isStellarToken = (token: string | undefined) => 
    token === '0x0000000000000000000000000000000000000000' || // XLM uses zero address
    (token && (token.includes(':') || token.length > 42)); // Stellar format
  
  if (isStellarToken(src as string) || isStellarToken(dst as string)) {
    console.log('[1inch Quote] Stellar token detected, using real Stellar exchange rates');
    console.log(`  Source: ${src}, Destination: ${dst}`);
    // Use real Stellar quote handler
    return handleStellarQuote(req, res);
  }
  
  // For non-Stellar, use real 1inch API
  next();
}, validateQuote, oneinchApiProxy);

// Mount other proxy routes with validation and specific rate limits
app.post('/api/1inch/swap', swapLimiter, validateSwap, oneinchApiProxy);
app.use('/api/1inch', oneinchApiProxy);

app.get('/api/fusion/quote', quoteLimiter, (req: Request, res: Response, next: NextFunction) => {
  const { src, dst } = req.query;
  
  // Check if this involves Stellar tokens
  const isStellarToken = (token: string | undefined) => 
    token === '0x0000000000000000000000000000000000000000' || // XLM uses zero address
    (token && (token.includes(':') || token.length > 42)); // Stellar format
  
  if (isStellarToken(src as string) || isStellarToken(dst as string)) {
    // Use real Stellar quote handler
    return handleStellarQuote(req, res);
  }
  
  next();
}, validateQuote, fusionApiProxy);

app.post('/api/fusion/swap', swapLimiter, validateSwap, fusionApiProxy);
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
  console.log('');
  
  if (!process.env.ONEINCH_API_KEY) {
    console.log('⚠️  No 1inch API key found. Some features may be limited.');
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