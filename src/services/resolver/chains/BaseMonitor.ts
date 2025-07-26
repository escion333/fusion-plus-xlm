import { EventEmitter } from 'events';
import { ChainConfig } from '../../../config/chains';
import { EscrowEvent } from '../../../types/swap';
import { logger } from '../utils/logger';

export interface ResolverAccount {
  address: string;
  privateKey: string;
}

export abstract class BaseMonitor extends EventEmitter {
  protected lastProcessedBlock: number = 0;
  protected isRunning: boolean = false;
  protected pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    protected chainConfig: ChainConfig,
    protected resolverAccount: ResolverAccount,
    protected pollingIntervalMs: number = 5000
  ) {
    super();
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getLatestBlock(): Promise<number>;
  abstract processBlock(blockNumber: number): Promise<EscrowEvent[]>;
  abstract deployEscrow(params: any): Promise<string>;
  abstract withdrawFromEscrow(escrowAddress: string, secret: string): Promise<string>;
  abstract cancelEscrow(escrowAddress: string): Promise<string>;
  abstract getEscrowState(escrowAddress: string): Promise<any>;

  protected async startPolling() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Load last processed block from storage
    this.lastProcessedBlock = await this.loadLastProcessedBlock();
    
    // Start polling loop
    this.poll();
  }

  protected async stopPolling() {
    this.isRunning = false;
    
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      const latestBlock = await this.getLatestBlock();
      
      // Process any missed blocks
      while (this.lastProcessedBlock < latestBlock - this.chainConfig.confirmations) {
        this.lastProcessedBlock++;
        
        try {
          const events = await this.processBlock(this.lastProcessedBlock);
          
          for (const event of events) {
            this.emit('escrowEvent', event);
          }
          
          // Save progress
          await this.saveLastProcessedBlock(this.lastProcessedBlock);
        } catch (error) {
          logger.error(`Error processing block ${this.lastProcessedBlock}:`, error);
          // Don't increment on error to retry
          this.lastProcessedBlock--;
          break;
        }
      }
    } catch (error) {
      logger.error('Error in polling loop:', error);
    }

    // Schedule next poll
    this.pollingInterval = setTimeout(() => this.poll(), this.pollingIntervalMs);
  }

  protected async loadLastProcessedBlock(): Promise<number> {
    // TODO: Load from database
    return 0;
  }

  protected async saveLastProcessedBlock(_blockNumber: number): Promise<void> {
    // TODO: Save to database
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }
}