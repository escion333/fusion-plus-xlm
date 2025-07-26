#!/usr/bin/env node

import { ResolverService, ResolverConfig } from './ResolverService';
import { logger } from './utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Build configuration from environment
const config: ResolverConfig = {
  chains: (process.env.RESOLVER_CHAINS || 'sepolia,stellarTestnet').split(',') as any,
  polling: {
    interval: parseInt(process.env.RESOLVER_POLLING_INTERVAL || '5000', 10),
    enabled: process.env.RESOLVER_POLLING_ENABLED !== 'false',
  },
  resolver: {
    address: process.env.RESOLVER_ADDRESS || '',
    privateKey: process.env.RESOLVER_PRIVATE_KEY || '',
  },
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/fusion_resolver',
  },
};

// Validate configuration
if (!config.resolver.address || !config.resolver.privateKey) {
  logger.error('RESOLVER_ADDRESS and RESOLVER_PRIVATE_KEY must be set');
  process.exit(1);
}

// Create and start resolver service
const resolver = new ResolverService(config);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await resolver.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await resolver.stop();
  process.exit(0);
});

// Start the service
(async () => {
  try {
    await resolver.start();
    
    // Log status periodically
    setInterval(() => {
      const status = resolver.getStatus();
      logger.info('Resolver status', status);
    }, 60000); // Every minute
    
  } catch (error) {
    logger.error('Failed to start resolver service:', error);
    process.exit(1);
  }
})();