import { Pool } from 'pg';
import { SwapOrder, SwapStatus } from '../../types/swap';
import { logger } from '../../services/resolver/utils/logger';

export class SwapRepository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    // Create tables if they don't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS swaps (
        id VARCHAR(66) PRIMARY KEY,
        order_hash VARCHAR(66) UNIQUE NOT NULL,
        maker VARCHAR(255) NOT NULL,
        taker VARCHAR(255) NOT NULL,
        maker_asset VARCHAR(255) NOT NULL,
        taker_asset VARCHAR(255),
        maker_amount VARCHAR(255) NOT NULL,
        taker_amount VARCHAR(255),
        source_chain VARCHAR(50) NOT NULL,
        destination_chain VARCHAR(50) NOT NULL,
        hashlock VARCHAR(66) NOT NULL,
        secret VARCHAR(66),
        timelocks JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
      CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps(created_at);
      CREATE INDEX IF NOT EXISTS idx_swaps_order_hash ON swaps(order_hash);
    `;

    try {
      await this.pool.query(createTableQuery);
      logger.info('Swap repository initialized');
    } catch (error) {
      logger.error('Failed to initialize swap repository:', error);
      throw error;
    }
  }

  async create(swap: SwapOrder): Promise<void> {
    const query = `
      INSERT INTO swaps (
        id, order_hash, maker, taker, maker_asset, taker_asset,
        maker_amount, taker_amount, source_chain, destination_chain,
        hashlock, secret, timelocks, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;

    const values = [
      swap.id,
      swap.orderHash,
      swap.maker,
      swap.taker,
      swap.makerAsset,
      swap.takerAsset,
      swap.makerAmount,
      swap.takerAmount,
      swap.sourceChain,
      swap.destinationChain,
      swap.hashlock,
      swap.secret,
      JSON.stringify(swap.timelocks),
      swap.status,
      swap.createdAt,
      swap.updatedAt,
    ];

    try {
      await this.pool.query(query, values);
      logger.info('Swap created', { orderHash: swap.orderHash });
    } catch (error) {
      logger.error('Failed to create swap:', error);
      throw error;
    }
  }

  async update(swap: SwapOrder): Promise<void> {
    const query = `
      UPDATE swaps SET
        maker = $2, taker = $3, maker_asset = $4, taker_asset = $5,
        maker_amount = $6, taker_amount = $7, source_chain = $8,
        destination_chain = $9, hashlock = $10, secret = $11,
        timelocks = $12, status = $13, updated_at = NOW()
      WHERE id = $1
    `;

    const values = [
      swap.id,
      swap.maker,
      swap.taker,
      swap.makerAsset,
      swap.takerAsset,
      swap.makerAmount,
      swap.takerAmount,
      swap.sourceChain,
      swap.destinationChain,
      swap.hashlock,
      swap.secret,
      JSON.stringify(swap.timelocks),
      swap.status,
    ];

    try {
      await this.pool.query(query, values);
      logger.info('Swap updated', { orderHash: swap.orderHash, status: swap.status });
    } catch (error) {
      logger.error('Failed to update swap:', error);
      throw error;
    }
  }

  async findByOrderHash(orderHash: string): Promise<SwapOrder | null> {
    const query = 'SELECT * FROM swaps WHERE order_hash = $1';

    try {
      const result = await this.pool.query(query, [orderHash]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSwap(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find swap:', error);
      throw error;
    }
  }

  async findByStatus(status: SwapStatus): Promise<SwapOrder[]> {
    const query = 'SELECT * FROM swaps WHERE status = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [status]);
      return result.rows.map(row => this.mapRowToSwap(row));
    } catch (error) {
      logger.error('Failed to find swaps by status:', error);
      throw error;
    }
  }

  async findActive(): Promise<SwapOrder[]> {
    const query = `
      SELECT * FROM swaps 
      WHERE status NOT IN ($1, $2, $3)
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [
        SwapStatus.COMPLETED,
        SwapStatus.CANCELLED,
        SwapStatus.FAILED,
      ]);
      
      return result.rows.map(row => this.mapRowToSwap(row));
    } catch (error) {
      logger.error('Failed to find active swaps:', error);
      throw error;
    }
  }

  async getActiveCount(): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM swaps 
      WHERE status NOT IN ($1, $2, $3)
    `;

    try {
      const result = await this.pool.query(query, [
        SwapStatus.COMPLETED,
        SwapStatus.CANCELLED,
        SwapStatus.FAILED,
      ]);
      
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get active count:', error);
      return 0;
    }
  }

  private mapRowToSwap(row: any): SwapOrder {
    return {
      id: row.id,
      orderHash: row.order_hash,
      maker: row.maker,
      taker: row.taker,
      makerAsset: row.maker_asset,
      takerAsset: row.taker_asset,
      makerAmount: row.maker_amount,
      takerAmount: row.taker_amount,
      sourceChain: row.source_chain,
      destinationChain: row.destination_chain,
      hashlock: row.hashlock,
      secret: row.secret,
      timelocks: typeof row.timelocks === 'string' ? JSON.parse(row.timelocks) : row.timelocks,
      status: row.status as SwapStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}