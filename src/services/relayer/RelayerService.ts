import express from 'express';
import { ethers } from 'ethers';
import { OrderBuilder } from '../1inch/OrderBuilder';
import { EventEmitter } from 'events';

interface Intent {
  id: string;
  orderHash: string;
  order: any;
  signature: string;
  stellarReceiver: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  status: 'pending' | 'picked_up' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  resolver?: string;
}

export class RelayerService extends EventEmitter {
  private app: express.Application;
  private intents: Map<string, Intent>;
  private resolvers: Set<string>;
  private port: number;

  constructor(port: number = 3001) {
    super();
    this.app = express();
    this.intents = new Map();
    this.resolvers = new Set();
    this.port = port;
    this.setupRoutes();
    this.setupMiddleware();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'Fusion+ Relayer',
        intents: this.intents.size,
        resolvers: this.resolvers.size,
        timestamp: Date.now()
      });
    });

    // Submit intent
    this.app.post('/submit-intent', (req, res) => {
      try {
        const { order, signature, orderHash, stellarReceiver, metadata } = req.body;

        if (!order || !signature || !orderHash) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate signature
        const recoveredSigner = ethers.verifyMessage(orderHash, signature);
        if (recoveredSigner.toLowerCase() !== order.maker.toLowerCase()) {
          return res.status(400).json({ error: 'Invalid signature' });
        }

        const intent: Intent = {
          id: orderHash,
          orderHash,
          order,
          signature,
          stellarReceiver,
          sourceChain: metadata?.sourceChain || 'base',
          destinationChain: metadata?.destinationChain || 'stellar',
          amount: ethers.formatEther(order.makingAmount),
          status: 'pending',
          timestamp: Date.now()
        };

        this.intents.set(orderHash, intent);

        console.log(`📡 New intent received: ${orderHash}`);
        console.log(`   Amount: ${intent.amount} ETH → Stellar`);
        console.log(`   Destination: ${stellarReceiver}`);

        // Notify resolvers
        this.emit('new-intent', intent);

        res.json({
          success: true,
          intentId: orderHash,
          status: 'broadcasted',
          message: 'Intent submitted to resolver network'
        });

      } catch (error: any) {
        console.error('Intent submission error:', error.message);
        res.status(500).json({ error: 'Failed to process intent' });
      }
    });

    // Get pending intents (for resolvers)
    this.app.get('/intents/pending', (req, res) => {
      const pendingIntents = Array.from(this.intents.values())
        .filter(intent => intent.status === 'pending')
        .sort((a, b) => b.timestamp - a.timestamp);

      res.json({
        intents: pendingIntents,
        count: pendingIntents.length
      });
    });

    // Get intent by ID
    this.app.get('/intents/:id', (req, res) => {
      const intent = this.intents.get(req.params.id);
      if (!intent) {
        return res.status(404).json({ error: 'Intent not found' });
      }
      res.json(intent);
    });

    // Resolver registration
    this.app.post('/register-resolver', (req, res) => {
      const { address, capabilities } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Resolver address required' });
      }

      this.resolvers.add(address);
      console.log(`🔧 Resolver registered: ${address}`);

      res.json({
        success: true,
        message: 'Resolver registered successfully',
        totalResolvers: this.resolvers.size
      });
    });

    // Update intent status (from resolver)
    this.app.put('/intents/:id/status', (req, res) => {
      const { status, resolver, txHash, stellarEscrow } = req.body;
      const intent = this.intents.get(req.params.id);

      if (!intent) {
        return res.status(404).json({ error: 'Intent not found' });
      }

      intent.status = status;
      if (resolver) intent.resolver = resolver;

      console.log(`📊 Intent ${req.params.id} status: ${status}`);
      if (txHash) console.log(`   TX: ${txHash}`);
      if (stellarEscrow) console.log(`   Stellar Escrow: ${stellarEscrow}`);

      this.emit('intent-updated', intent);

      res.json({
        success: true,
        intent: intent
      });
    });

    // Get all intents (admin)
    this.app.get('/intents', (req, res) => {
      const allIntents = Array.from(this.intents.values())
        .sort((a, b) => b.timestamp - a.timestamp);

      const stats = {
        total: allIntents.length,
        pending: allIntents.filter(i => i.status === 'pending').length,
        executing: allIntents.filter(i => i.status === 'executing').length,
        completed: allIntents.filter(i => i.status === 'completed').length,
        failed: allIntents.filter(i => i.status === 'failed').length
      };

      res.json({
        intents: allIntents,
        stats
      });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`🚀 Fusion+ Relayer Service running on port ${this.port}`);
        console.log(`📡 Ready to receive cross-chain intents`);
        resolve();
      });
    });
  }

  public stop(): void {
    // In a real implementation, you'd properly close the server
    console.log('🛑 Relayer service stopped');
  }

  // Get service stats
  public getStats() {
    const allIntents = Array.from(this.intents.values());
    return {
      totalIntents: allIntents.length,
      pendingIntents: allIntents.filter(i => i.status === 'pending').length,
      executingIntents: allIntents.filter(i => i.status === 'executing').length,
      completedIntents: allIntents.filter(i => i.status === 'completed').length,
      failedIntents: allIntents.filter(i => i.status === 'failed').length,
      activeResolvers: this.resolvers.size,
      uptime: process.uptime()
    };
  }
}