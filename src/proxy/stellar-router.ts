import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Extended resolver service URL
const EXTENDED_RESOLVER_URL = process.env.EXTENDED_RESOLVER_URL || 'http://localhost:3002';

// Route Stellar-related orders to our extended resolver
router.post('/api/fusion/orders/create', async (req: Request, res: Response) => {
  try {
    const order = req.body;
    
    // Check if this is a Stellar cross-chain order
    const isStellarOrder = 
      order.crossChain?.destinationChain === 'stellar' ||
      order.makerAsset?.includes('stellar') ||
      order.takerAsset?.includes('stellar');
    
    if (isStellarOrder) {
      console.log('Routing Stellar order to extended resolver');
      
      // Forward to our extended resolver
      const response = await fetch(`${EXTENDED_RESOLVER_URL}/api/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order,
          signature: req.body.signature || '',
          srcChainId: 1, // Ethereum
          dstChainId: 1001, // Stellar
        }),
      });
      
      const result = await response.json();
      
      // Return in format expected by frontend
      return res.json({
        orderHash: result.orderId,
        status: 'processing',
        ...order,
      });
    }
    
    // For non-Stellar orders, continue with normal 1inch flow
    next();
  } catch (error) {
    console.error('Error routing Stellar order:', error);
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// Get order status from extended resolver
router.get('/api/fusion/orders/:orderHash', async (req: Request, res: Response) => {
  try {
    const { orderHash } = req.params;
    
    // Try extended resolver first
    const response = await fetch(`${EXTENDED_RESOLVER_URL}/api/orders/${orderHash}/status`);
    
    if (response.ok) {
      const result = await response.json();
      return res.json({
        order: {
          orderHash,
          status: result.status,
          ...result.details,
        },
      });
    }
    
    // Fall through to regular 1inch handler
    next();
  } catch (error) {
    next();
  }
});

export default router;