import { EventEmitter } from 'events';
import { logger } from './utils/logger';

export interface TimelockData {
  orderHash: string;
  srcWithdrawal: number;
  srcPublicWithdrawal: number;
  srcCancellation: number;
  srcPublicCancellation: number;
  dstWithdrawal: number;
  dstPublicWithdrawal: number;
  dstCancellation: number;
}

export class TimelockManager extends EventEmitter {
  private timelocks: Map<string, TimelockData> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Starting timelock manager');
    
    // Check timelocks every 5 seconds
    this.checkInterval = setInterval(() => this.checkTimelocks(), 5000);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    logger.info('Stopping timelock manager');
    
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a swap with its timelocks
   */
  async registerSwap(orderHash: string, timelocks: bigint | TimelockData): Promise<void> {
    let timelockData: TimelockData;
    
    if (typeof timelocks === 'bigint') {
      // Unpack bit-packed timelocks
      timelockData = this.unpackTimelocks(orderHash, timelocks);
    } else {
      timelockData = timelocks;
    }
    
    this.timelocks.set(orderHash, timelockData);
    logger.info(`Registered timelocks for order ${orderHash}`, timelockData);
    
    // Set up timers for critical timelocks
    this.setupTimers(orderHash, timelockData);
  }

  /**
   * Unpack bit-packed timelocks
   */
  private unpackTimelocks(orderHash: string, packed: bigint): TimelockData {
    // Each timelock is 5 bytes (40 bits)
    const mask = (1n << 40n) - 1n;
    
    return {
      orderHash,
      srcWithdrawal: Number((packed >> 0n) & mask),
      srcPublicWithdrawal: Number((packed >> 40n) & mask),
      srcCancellation: Number((packed >> 80n) & mask),
      srcPublicCancellation: Number((packed >> 120n) & mask),
      dstWithdrawal: Number((packed >> 160n) & mask),
      dstPublicWithdrawal: Number((packed >> 200n) & mask),
      dstCancellation: Number((packed >> 240n) & mask),
    };
  }

  /**
   * Set up timers for important timelock events
   */
  private setupTimers(orderHash: string, timelocks: TimelockData): void {
    const now = Math.floor(Date.now() / 1000);
    
    // Set timer for public withdrawal windows
    const publicWithdrawalTimes = [
      { type: 'srcPublicWithdrawal', time: timelocks.srcPublicWithdrawal },
      { type: 'dstPublicWithdrawal', time: timelocks.dstPublicWithdrawal },
    ];
    
    for (const { type, time } of publicWithdrawalTimes) {
      if (time > now) {
        const delay = (time - now) * 1000;
        const timer = setTimeout(() => {
          this.emit('timelockExpired', { orderHash, timelockType: type, timestamp: time });
        }, delay);
        
        this.timers.set(`${orderHash}-${type}`, timer);
      }
    }
    
    // Set timer for cancellation windows
    const cancellationTimes = [
      { type: 'srcCancellation', time: timelocks.srcCancellation },
      { type: 'dstCancellation', time: timelocks.dstCancellation },
    ];
    
    for (const { type, time } of cancellationTimes) {
      if (time > now) {
        const delay = (time - now) * 1000;
        const timer = setTimeout(() => {
          this.emit('timelockExpired', { orderHash, timelockType: type, timestamp: time });
        }, delay);
        
        this.timers.set(`${orderHash}-${type}`, timer);
      }
    }
  }

  /**
   * Check all timelocks periodically
   */
  private checkTimelocks(): void {
    const now = Math.floor(Date.now() / 1000);
    
    for (const [orderHash, timelocks] of this.timelocks.entries()) {
      // Check if any timelock has expired that we haven't processed
      this.checkTimelock(orderHash, 'srcWithdrawal', timelocks.srcWithdrawal, now);
      this.checkTimelock(orderHash, 'srcPublicWithdrawal', timelocks.srcPublicWithdrawal, now);
      this.checkTimelock(orderHash, 'srcCancellation', timelocks.srcCancellation, now);
      this.checkTimelock(orderHash, 'srcPublicCancellation', timelocks.srcPublicCancellation, now);
      this.checkTimelock(orderHash, 'dstWithdrawal', timelocks.dstWithdrawal, now);
      this.checkTimelock(orderHash, 'dstPublicWithdrawal', timelocks.dstPublicWithdrawal, now);
      this.checkTimelock(orderHash, 'dstCancellation', timelocks.dstCancellation, now);
    }
  }

  /**
   * Check individual timelock
   */
  private checkTimelock(orderHash: string, type: string, timestamp: number, now: number): void {
    const key = `${orderHash}-${type}-processed`;
    
    // Check if we've already processed this timelock
    if (this.timers.has(key)) {
      return;
    }
    
    if (timestamp > 0 && timestamp <= now) {
      // Mark as processed
      this.timers.set(key, setTimeout(() => {}, 0));
      
      // Emit event
      this.emit('timelockExpired', { orderHash, timelockType: type, timestamp });
    }
  }

  /**
   * Get timelock data for a swap
   */
  getTimelocks(orderHash: string): TimelockData | undefined {
    return this.timelocks.get(orderHash);
  }

  /**
   * Remove timelock data for completed swaps
   */
  removeSwap(orderHash: string): void {
    this.timelocks.delete(orderHash);
    
    // Clear associated timers
    const keysToDelete: string[] = [];
    for (const key of this.timers.keys()) {
      if (key.startsWith(orderHash)) {
        const timer = this.timers.get(key);
        if (timer) clearTimeout(timer);
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.timers.delete(key);
    }
    
    logger.info(`Removed timelocks for order ${orderHash}`);
  }

  /**
   * Get active timelock count for monitoring
   */
  getTimelockCount(): number {
    return this.timelocks.size;
  }

  /**
   * Check if a specific action is allowed based on timelocks
   */
  isActionAllowed(orderHash: string, action: string, isPublic: boolean = false): boolean {
    const timelocks = this.timelocks.get(orderHash);
    if (!timelocks) return false;
    
    const now = Math.floor(Date.now() / 1000);
    
    switch (action) {
      case 'srcWithdraw':
        return isPublic 
          ? now >= timelocks.srcPublicWithdrawal 
          : now >= timelocks.srcWithdrawal;
          
      case 'dstWithdraw':
        return isPublic 
          ? now >= timelocks.dstPublicWithdrawal 
          : now >= timelocks.dstWithdrawal;
          
      case 'srcCancel':
        return isPublic 
          ? now >= timelocks.srcPublicCancellation 
          : now >= timelocks.srcCancellation;
          
      case 'dstCancel':
        return now >= timelocks.dstCancellation;
        
      default:
        return false;
    }
  }
}