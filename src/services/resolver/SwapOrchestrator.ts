import { EventEmitter } from 'events';
import { SecretManager } from './SecretManager';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { BaseMonitor } from './chains/BaseMonitor';
import { EscrowEvent, SwapOrder, SwapStatus } from '../../types/swap';
import { logger } from './utils/logger';

export class SwapOrchestrator extends EventEmitter {
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor(
    private secretManager: SecretManager,
    private swapRepository: SwapRepository,
    private chainMonitors: Map<string, BaseMonitor>
  ) {
    super();
  }

  async start(): Promise<void> {
    logger.info('Starting swap orchestrator');
    
    // Clean up old secrets periodically
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.secretManager.cleanup(oneWeekAgo);
    }, 60 * 60 * 1000); // Every hour
  }

  async stop(): Promise<void> {
    logger.info('Stopping swap orchestrator');
    
    // Wait for all processing to complete
    await Promise.all(this.processingQueue.values());
  }

  /**
   * Create a new swap from source chain escrow creation
   */
  async createNewSwap(sourceChain: string, event: EscrowEvent): Promise<void> {
    const orderHash = event.orderHash;
    
    // Prevent duplicate processing
    if (this.processingQueue.has(orderHash)) {
      await this.processingQueue.get(orderHash);
      return;
    }

    const processing = this.processNewSwap(sourceChain, event);
    this.processingQueue.set(orderHash, processing);
    
    try {
      await processing;
    } finally {
      this.processingQueue.delete(orderHash);
    }
  }

  private async processNewSwap(sourceChain: string, event: EscrowEvent): Promise<void> {
    logger.info(`Creating new swap from ${sourceChain}`, { orderHash: event.orderHash });
    
    // Generate secret for this swap
    const secretData = this.secretManager.generateSecret(event.orderHash);
    
    // Determine destination chain
    const destinationChain = this.getCounterpartChain(sourceChain);
    if (!destinationChain) {
      logger.error(`No counterpart chain for ${sourceChain}`);
      return;
    }

    // Create swap record
    const swap: SwapOrder = {
      id: event.orderHash,
      orderHash: event.orderHash,
      maker: event.data.maker,
      taker: event.data.taker,
      makerAsset: event.data.token,
      takerAsset: '', // Will be set when destination escrow is created
      makerAmount: event.data.amount,
      takerAmount: '0', // Will be set when destination escrow is created
      sourceChain,
      destinationChain,
      hashlock: secretData.hashedSecret,
      secret: secretData.secret,
      timelocks: this.parseTimelocks(event.data.timelocks),
      status: SwapStatus.SOURCE_FUNDED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.swapRepository.create(swap);
    
    // Deploy counterpart escrow on destination chain
    await this.deployCounterpartEscrow(swap, destinationChain);
  }

  /**
   * Handle counterpart escrow creation
   */
  async handleCounterpartCreation(swap: SwapOrder, chain: string, event: EscrowEvent): Promise<void> {
    logger.info(`Counterpart escrow created on ${chain}`, { orderHash: swap.orderHash });
    
    // Update swap status
    if (chain === swap.destinationChain) {
      swap.status = SwapStatus.DESTINATION_DEPLOYED;
      swap.takerAsset = event.data.token;
      swap.takerAmount = event.data.amount;
    }
    
    await this.swapRepository.update(swap);
    
    // Check if we should reveal the secret
    await this.checkSecretReveal(swap);
  }

  /**
   * Deploy escrow on counterpart chain
   */
  private async deployCounterpartEscrow(swap: SwapOrder, chain: string): Promise<void> {
    const monitor = this.chainMonitors.get(chain);
    if (!monitor) {
      logger.error(`No monitor for chain ${chain}`);
      return;
    }

    try {
      // Calculate counterpart parameters
      const params = this.calculateCounterpartParams(swap, chain);
      
      // Deploy escrow
      const escrowAddress = await monitor.deployEscrow(params);
      
      logger.info(`Deployed counterpart escrow on ${chain}`, {
        orderHash: swap.orderHash,
        escrowAddress,
      });
      
      // Update swap record
      swap.status = SwapStatus.DESTINATION_DEPLOYED;
      await this.swapRepository.update(swap);
      
    } catch (error) {
      logger.error(`Failed to deploy counterpart escrow: ${error}`, {
        orderHash: swap.orderHash,
        chain,
      });
      
      // Update status to failed
      swap.status = SwapStatus.FAILED;
      await this.swapRepository.update(swap);
    }
  }

  /**
   * Calculate parameters for counterpart escrow
   */
  private calculateCounterpartParams(swap: SwapOrder, chain: string): any {
    // Swap maker/taker for counterpart
    return {
      orderHash: swap.orderHash,
      hashlock: swap.hashlock,
      maker: swap.taker, // Swapped
      taker: swap.maker, // Swapped
      token: swap.takerAsset || this.getDefaultToken(chain),
      amount: swap.takerAmount || '0',
      safetyDeposit: '0', // TODO: Calculate safety deposit
      timelocks: this.packTimelocks(swap.timelocks),
    };
  }

  /**
   * Check if we should reveal the secret
   */
  private async checkSecretReveal(swap: SwapOrder): Promise<void> {
    // Only reveal if both escrows are deployed and funded
    if (swap.status !== SwapStatus.DESTINATION_FUNDED) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Check if it's time to reveal
    if (this.secretManager.shouldRevealSecret(swap.orderHash, now, swap.timelocks.dstWithdrawal)) {
      await this.revealSecret(swap, swap.destinationChain);
    }
  }

  /**
   * Reveal secret on specified chain
   */
  private async revealSecret(swap: SwapOrder, chain: string): Promise<void> {
    const monitor = this.chainMonitors.get(chain);
    if (!monitor || !swap.secret) {
      return;
    }

    try {
      const escrowAddress = await this.getEscrowAddress(swap, chain);
      const txHash = await monitor.withdrawFromEscrow(escrowAddress, swap.secret);
      
      logger.info(`Revealed secret on ${chain}`, {
        orderHash: swap.orderHash,
        txHash,
      });
      
    } catch (error) {
      logger.error(`Failed to reveal secret: ${error}`, {
        orderHash: swap.orderHash,
        chain,
      });
    }
  }

  /**
   * Execute withdrawal on specified chain
   */
  async executeWithdrawal(swap: SwapOrder, chain: string): Promise<void> {
    if (!swap.secret) {
      logger.error('Cannot withdraw without secret', { orderHash: swap.orderHash });
      return;
    }

    const monitor = this.chainMonitors.get(chain);
    if (!monitor) {
      return;
    }

    try {
      const escrowAddress = await this.getEscrowAddress(swap, chain);
      const txHash = await monitor.withdrawFromEscrow(escrowAddress, swap.secret);
      
      logger.info(`Executed withdrawal on ${chain}`, {
        orderHash: swap.orderHash,
        txHash,
      });
      
    } catch (error) {
      logger.error(`Failed to execute withdrawal: ${error}`, {
        orderHash: swap.orderHash,
        chain,
      });
    }
  }

  /**
   * Execute public withdrawal after timelock
   */
  async executePublicWithdrawal(swap: SwapOrder, chain: string): Promise<void> {
    if (!swap.secret) {
      logger.error('Cannot withdraw without secret', { orderHash: swap.orderHash });
      return;
    }

    // Use public withdrawal function
    // Implementation depends on contract interface
    await this.executeWithdrawal(swap, chain);
  }

  /**
   * Execute cancellation on specified chain
   */
  async executeCancellation(swap: SwapOrder, chain: string): Promise<void> {
    const monitor = this.chainMonitors.get(chain);
    if (!monitor) {
      return;
    }

    try {
      const escrowAddress = await this.getEscrowAddress(swap, chain);
      const txHash = await monitor.cancelEscrow(escrowAddress);
      
      logger.info(`Executed cancellation on ${chain}`, {
        orderHash: swap.orderHash,
        txHash,
      });
      
    } catch (error) {
      logger.error(`Failed to execute cancellation: ${error}`, {
        orderHash: swap.orderHash,
        chain,
      });
    }
  }

  /**
   * Check if escrow is withdrawn on specified chain
   */
  async isWithdrawn(swap: SwapOrder, chain: string): Promise<boolean> {
    const monitor = this.chainMonitors.get(chain);
    if (!monitor) {
      return false;
    }

    try {
      const escrowAddress = await this.getEscrowAddress(swap, chain);
      const state = await monitor.getEscrowState(escrowAddress);
      
      return state.state === 'Withdrawn';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get escrow address for swap on specified chain
   */
  private async getEscrowAddress(swap: SwapOrder, chain: string): Promise<string> {
    // TODO: Implement escrow address tracking
    // For now, return placeholder
    return `escrow-${swap.orderHash}-${chain}`;
  }

  /**
   * Get counterpart chain
   */
  private getCounterpartChain(chain: string): string | null {
    // Simple mapping for now
    const mapping: Record<string, string> = {
      'ethereum': 'stellar',
      'stellar': 'ethereum',
      'sepolia': 'stellarTestnet',
      'stellarTestnet': 'sepolia',
    };
    
    return mapping[chain] || null;
  }

  /**
   * Get default token for chain
   */
  private getDefaultToken(chain: string): string {
    if (chain.includes('stellar')) {
      return 'native'; // XLM
    }
    return '0x0000000000000000000000000000000000000000'; // ETH
  }

  /**
   * Parse bit-packed timelocks
   */
  private parseTimelocks(timelocks: bigint | any): any {
    if (typeof timelocks === 'bigint') {
      const mask = (1n << 40n) - 1n;
      
      return {
        srcWithdrawal: Number((timelocks >> 0n) & mask),
        srcPublicWithdrawal: Number((timelocks >> 40n) & mask),
        srcCancellation: Number((timelocks >> 80n) & mask),
        srcPublicCancellation: Number((timelocks >> 120n) & mask),
        dstWithdrawal: Number((timelocks >> 160n) & mask),
        dstPublicWithdrawal: Number((timelocks >> 200n) & mask),
        dstCancellation: Number((timelocks >> 240n) & mask),
      };
    }
    
    return timelocks;
  }

  /**
   * Pack timelocks into bit-packed format
   */
  private packTimelocks(timelocks: any): bigint {
    return (
      BigInt(timelocks.srcWithdrawal) |
      (BigInt(timelocks.srcPublicWithdrawal) << 40n) |
      (BigInt(timelocks.srcCancellation) << 80n) |
      (BigInt(timelocks.srcPublicCancellation) << 120n) |
      (BigInt(timelocks.dstWithdrawal) << 160n) |
      (BigInt(timelocks.dstPublicWithdrawal) << 200n) |
      (BigInt(timelocks.dstCancellation) << 240n)
    );
  }
}