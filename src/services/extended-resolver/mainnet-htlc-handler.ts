import { StellarHTLCMainnet } from '../../../scripts/stellar-htlc-mainnet';
import { logger } from '../resolver/utils/logger';
import crypto from 'crypto';

export interface HTLCOrder {
  orderId: string;
  srcChain: string;
  dstChain: string;
  maker: string;
  taker: string;
  amount: string;
  token: string;
  stellarReceiver: string;
}

export class MainnetHTLCHandler {
  private htlc: StellarHTLCMainnet;
  private activeOrders: Map<string, any>;

  constructor() {
    this.htlc = new StellarHTLCMainnet();
    this.activeOrders = new Map();
  }

  /**
   * Handle a new cross-chain order that involves Stellar mainnet
   */
  async handleCrossChainOrder(order: HTLCOrder) {
    try {
      logger.info('Processing mainnet HTLC order', { orderId: order.orderId });

      // Generate secret for this order
      const secret = crypto.randomBytes(32).toString('hex');
      const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');

      // Store order details
      this.activeOrders.set(order.orderId, {
        ...order,
        secret,
        secretHash,
        status: 'creating_escrow',
        created: new Date().toISOString(),
      });

      // Create HTLC escrow on Stellar mainnet
      const escrowResult = await this.htlc.createHTLCEscrow({
        maker: order.stellarReceiver || process.env.DEMO_STELLAR_USER!,
        taker: process.env.DEMO_STELLAR_RESOLVER!,
        amount: this.convertToXLM(order.amount, order.token),
        secret,
        timelockSeconds: 3600, // 1 hour
      });

      if (escrowResult.success) {
        // Update order status
        const orderData = this.activeOrders.get(order.orderId);
        orderData.status = 'escrow_created';
        orderData.escrowAddress = escrowResult.escrowAddress;
        orderData.stellarTxHash = escrowResult.transactionHash;
        orderData.explorerUrl = `https://stellar.expert/explorer/public/tx/${escrowResult.transactionHash}`;

        logger.info('Mainnet HTLC escrow created', {
          orderId: order.orderId,
          txHash: escrowResult.transactionHash,
          escrowAddress: escrowResult.escrowAddress,
        });

        return {
          success: true,
          orderId: order.orderId,
          secret: escrowResult.secret,
          secretHash: escrowResult.secretHash,
          escrowAddress: escrowResult.escrowAddress,
          transactionHash: escrowResult.transactionHash,
          explorerUrl: orderData.explorerUrl,
        };
      } else {
        logger.error('Failed to create mainnet HTLC escrow', {
          orderId: order.orderId,
          error: escrowResult.error,
        });

        const orderData = this.activeOrders.get(order.orderId);
        orderData.status = 'failed';
        orderData.error = escrowResult.error;

        return {
          success: false,
          error: escrowResult.error,
        };
      }
    } catch (error) {
      logger.error('Error handling mainnet HTLC order', {
        orderId: order.orderId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if we should use real mainnet transactions
   */
  shouldUseMainnet(): boolean {
    return process.env.MOCK_MODE === 'false' && process.env.STELLAR_NETWORK === 'mainnet';
  }

  /**
   * Get order status
   */
  getOrderStatus(orderId: string) {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      return null;
    }

    return {
      orderId: order.orderId,
      status: order.status,
      escrowAddress: order.escrowAddress,
      stellarTxHash: order.stellarTxHash,
      explorerUrl: order.explorerUrl,
      created: order.created,
      error: order.error,
    };
  }

  /**
   * Convert amount to XLM based on token type
   */
  private convertToXLM(amount: string, token: string): string {
    // For demo purposes, we'll use small amounts
    // In production, this would use real exchange rates
    switch (token) {
      case 'USDC':
        // Assuming 1 USDC = 10 XLM for demo
        return (parseFloat(amount) * 10).toFixed(2);
      case 'ETH':
        // Assuming 1 ETH = 20000 XLM for demo
        return (parseFloat(amount) * 20000).toFixed(2);
      case 'XLM':
      default:
        return amount;
    }
  }

  /**
   * Reveal secret for an order (after user claims on destination chain)
   */
  async revealSecret(orderId: string): Promise<string | null> {
    const order = this.activeOrders.get(orderId);
    if (!order || !order.secret) {
      return null;
    }

    // In production, this would only reveal after confirming the destination chain claim
    order.status = 'secret_revealed';
    order.revealedAt = new Date().toISOString();

    logger.info('Secret revealed for order', { orderId });

    return order.secret;
  }
}