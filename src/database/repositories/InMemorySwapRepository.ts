import { SwapOrder, SwapStatus } from '../../types/swap';
import { logger } from '../../services/resolver/utils/logger';

// In-memory implementation for testing without PostgreSQL
export class InMemorySwapRepository {
  private swaps: Map<string, SwapOrder> = new Map();

  async initialize(): Promise<void> {
    logger.info('In-memory swap repository initialized');
  }

  async create(swap: Omit<SwapOrder, 'createdAt' | 'updatedAt'>): Promise<SwapOrder> {
    const newSwap: SwapOrder = {
      ...swap,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.swaps.set(swap.id, newSwap);
    logger.info('Swap created', { orderHash: swap.orderHash });
    return newSwap;
  }

  async findById(id: string): Promise<SwapOrder | null> {
    return this.swaps.get(id) || null;
  }

  async findByOrderHash(orderHash: string): Promise<SwapOrder | null> {
    for (const swap of this.swaps.values()) {
      if (swap.orderHash === orderHash) {
        return swap;
      }
    }
    return null;
  }

  async update(id: string, updates: Partial<SwapOrder>): Promise<SwapOrder | null> {
    const swap = this.swaps.get(id);
    if (!swap) return null;
    
    const updatedSwap: SwapOrder = {
      ...swap,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.swaps.set(id, updatedSwap);
    logger.info('Swap updated', { orderHash: swap.orderHash, status: updates.status });
    return updatedSwap;
  }

  async updateStatus(id: string, status: SwapStatus): Promise<SwapOrder | null> {
    return this.update(id, { status });
  }

  async findByStatus(status: SwapStatus, limit?: number): Promise<SwapOrder[]> {
    const results: SwapOrder[] = [];
    for (const swap of this.swaps.values()) {
      if (swap.status === status) {
        results.push(swap);
        if (limit && results.length >= limit) break;
      }
    }
    return results;
  }

  async getActiveCount(): Promise<number> {
    let count = 0;
    for (const swap of this.swaps.values()) {
      if (swap.status === SwapStatus.ACTIVE || swap.status === SwapStatus.PENDING) {
        count++;
      }
    }
    return count;
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deleted = 0;
    for (const [id, swap] of this.swaps.entries()) {
      if (swap.updatedAt < olderThan && 
          (swap.status === SwapStatus.COMPLETED || swap.status === SwapStatus.FAILED)) {
        this.swaps.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async close(): Promise<void> {
    this.swaps.clear();
    logger.info('In-memory repository closed');
  }
}