import { EventEmitter } from 'events';
import { EthereumMonitor } from './chains/EthereumMonitor';
import { StellarMonitor } from './chains/StellarMonitor';
import { SecretManager } from './SecretManager';
import { TimelockManager } from './TimelockManager';
import { SwapOrchestrator } from './SwapOrchestrator';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { logger } from './utils/logger';
import { CHAIN_CONFIGS, SupportedChain } from '../../config/chains';
import { EscrowEvent, SwapStatus } from '../../types/swap';

export interface ResolverConfig {
  chains: SupportedChain[];
  polling: {
    interval: number;
    enabled: boolean;
  };
  resolver: {
    address: string;
    privateKey: string;
  };
  database: {
    connectionString: string;
  };
}

export class ResolverService extends EventEmitter {
  private chainMonitors: Map<string, EthereumMonitor | StellarMonitor> = new Map();
  private secretManager: SecretManager;
  private timelockManager: TimelockManager;
  private swapOrchestrator: SwapOrchestrator;
  private swapRepository: SwapRepository;
  private isRunning: boolean = false;

  constructor(private config: ResolverConfig) {
    super();
    this.secretManager = new SecretManager();
    this.timelockManager = new TimelockManager();
    this.swapRepository = new SwapRepository(config.database.connectionString);
    this.swapOrchestrator = new SwapOrchestrator(
      this.secretManager,
      this.swapRepository,
      this.chainMonitors
    );
    
    this.initializeMonitors();
  }

  private initializeMonitors() {
    for (const chainId of this.config.chains) {
      const chainConfig = CHAIN_CONFIGS[chainId];
      if (!chainConfig) {
        logger.error(`Unknown chain: ${chainId}`);
        continue;
      }

      if (chainId.startsWith('stellar')) {
        this.chainMonitors.set(
          chainId,
          new StellarMonitor(chainConfig, this.config.resolver)
        );
      } else {
        this.chainMonitors.set(
          chainId,
          new EthereumMonitor(chainConfig, this.config.resolver)
        );
      }
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Resolver service is already running');
      return;
    }

    logger.info('Starting resolver service...');
    this.isRunning = true;

    // Initialize database
    await this.swapRepository.initialize();

    // Start chain monitors
    for (const [chainId, monitor] of this.chainMonitors) {
      monitor.on('escrowEvent', (event: EscrowEvent) => {
        this.handleEscrowEvent(chainId, event);
      });
      
      await monitor.start();
      logger.info(`Started monitoring ${chainId}`);
    }

    // Start timelock manager
    this.timelockManager.on('timelockExpired', async (data) => {
      await this.handleTimelockExpiration(data);
    });
    await this.timelockManager.start();

    // Start orchestrator
    await this.swapOrchestrator.start();

    logger.info('Resolver service started successfully');
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping resolver service...');
    this.isRunning = false;

    // Stop all monitors
    for (const monitor of this.chainMonitors.values()) {
      await monitor.stop();
    }

    // Stop managers
    await this.timelockManager.stop();
    await this.swapOrchestrator.stop();

    logger.info('Resolver service stopped');
  }

  private async handleEscrowEvent(chainId: string, event: EscrowEvent) {
    logger.info(`Received ${event.type} event on ${chainId}`, {
      orderHash: event.orderHash,
      escrowAddress: event.escrowAddress,
    });

    try {
      switch (event.type) {
        case 'EscrowCreated':
          await this.handleEscrowCreation(chainId, event);
          break;
        case 'SecretRevealed':
          await this.handleSecretRevealed(chainId, event);
          break;
        case 'EscrowCancelled':
          await this.handleEscrowCancelled(chainId, event);
          break;
        case 'EscrowWithdrawn':
          await this.handleEscrowWithdrawn(chainId, event);
          break;
      }
    } catch (error) {
      logger.error(`Error handling escrow event: ${error}`, { event });
    }
  }

  private async handleEscrowCreation(chainId: string, event: EscrowEvent) {
    // Check if this is a new swap or counterpart creation
    const existingSwap = await this.swapRepository.findByOrderHash(event.orderHash);

    if (!existingSwap) {
      // New swap initiated
      await this.swapOrchestrator.createNewSwap(chainId, event);
    } else {
      // Counterpart escrow created
      await this.swapOrchestrator.handleCounterpartCreation(existingSwap, chainId, event);
    }

    // Register with timelock manager
    await this.timelockManager.registerSwap(event.orderHash, event.data.timelocks);
  }

  private async handleSecretRevealed(chainId: string, event: EscrowEvent) {
    const swap = await this.swapRepository.findByOrderHash(event.orderHash);
    if (!swap) {
      logger.error('Secret revealed for unknown swap', { orderHash: event.orderHash });
      return;
    }

    // Store the revealed secret
    await this.secretManager.storeRevealedSecret(event.orderHash, event.data.secret);

    // Update swap status
    swap.status = SwapStatus.SECRET_REVEALED;
    swap.secret = event.data.secret;
    await this.swapRepository.update(swap);

    // Trigger withdrawal on the other chain
    const otherChain = swap.sourceChain === chainId ? swap.destinationChain : swap.sourceChain;
    await this.swapOrchestrator.executeWithdrawal(swap, otherChain);
  }

  private async handleEscrowCancelled(chainId: string, event: EscrowEvent) {
    const swap = await this.swapRepository.findByOrderHash(event.orderHash);
    if (!swap) {
      return;
    }

    // Update status
    swap.status = SwapStatus.CANCELLED;
    await this.swapRepository.update(swap);

    // Cancel on the other chain if needed
    const otherChain = swap.sourceChain === chainId ? swap.destinationChain : swap.sourceChain;
    await this.swapOrchestrator.executeCancellation(swap, otherChain);
  }

  private async handleEscrowWithdrawn(chainId: string, event: EscrowEvent) {
    const swap = await this.swapRepository.findByOrderHash(event.orderHash);
    if (!swap) {
      return;
    }

    // Update withdrawal status
    if (chainId === swap.sourceChain) {
      swap.status = SwapStatus.SOURCE_WITHDRAWN;
    } else {
      swap.status = SwapStatus.DESTINATION_WITHDRAWN;
    }

    // Check if both sides are withdrawn
    const sourceWithdrawn = await this.swapOrchestrator.isWithdrawn(swap, swap.sourceChain);
    const destWithdrawn = await this.swapOrchestrator.isWithdrawn(swap, swap.destinationChain);

    if (sourceWithdrawn && destWithdrawn) {
      swap.status = SwapStatus.COMPLETED;
    }

    await this.swapRepository.update(swap);
  }

  private async handleTimelockExpiration(data: any) {
    const { orderHash, timelockType } = data;
    const swap = await this.swapRepository.findByOrderHash(orderHash);
    
    if (!swap) {
      return;
    }

    logger.info(`Timelock expired: ${timelockType} for order ${orderHash}`);

    // Handle different timelock expirations
    switch (timelockType) {
      case 'srcPublicWithdrawal':
      case 'dstPublicWithdrawal':
        // Allow public withdrawal if secret is known
        if (swap.secret) {
          const chain = timelockType.startsWith('src') ? swap.sourceChain : swap.destinationChain;
          await this.swapOrchestrator.executePublicWithdrawal(swap, chain);
        }
        break;
      
      case 'srcCancellation':
      case 'dstCancellation':
        // Execute cancellation if swap is not completed
        if (swap.status !== SwapStatus.COMPLETED) {
          const chain = timelockType.startsWith('src') ? swap.sourceChain : swap.destinationChain;
          await this.swapOrchestrator.executeCancellation(swap, chain);
        }
        break;
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      chains: Array.from(this.chainMonitors.keys()),
      activeSwaps: this.swapRepository.getActiveCount(),
    };
  }
}