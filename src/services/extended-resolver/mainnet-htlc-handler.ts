import { StellarHTLCMainnet } from '../../../scripts/stellar-htlc-mainnet';
import { BaseHTLCHandler } from './base-htlc-handler';
import { StellarContractDeployer } from '../stellar/contract-deployer';
import { StellarFactoryService, EscrowParams } from '../stellar/factory-service';
import { getStellarContracts, isFactoryConfigured } from '../../config/stellar-contracts';
import { logger } from '../resolver/utils/logger';
import * as crypto from 'crypto';
import * as StellarSdk from 'stellar-sdk';
import { ethers } from 'ethers';

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
  private stellarHTLC: StellarHTLCMainnet;
  private baseHTLC: BaseHTLCHandler;
  private contractDeployer: StellarContractDeployer;
  private factoryService?: StellarFactoryService;
  private activeOrders: Map<string, any>;
  private deployerKeypair?: StellarSdk.Keypair;

  constructor() {
    this.stellarHTLC = new StellarHTLCMainnet();
    this.baseHTLC = new BaseHTLCHandler();
    this.contractDeployer = new StellarContractDeployer();
    this.activeOrders = new Map();
    
    // Initialize deployer keypair if available
    const deployerSecret = process.env.STELLAR_DEPLOYER_SECRET || process.env.STELLAR_TEST_WALLET_SECRET;
    if (deployerSecret) {
      try {
        this.deployerKeypair = StellarSdk.Keypair.fromSecret(deployerSecret);
        logger.info('Stellar deployer initialized', { 
          publicKey: this.deployerKeypair.publicKey() 
        });
      } catch (error) {
        logger.error('Failed to initialize Stellar deployer', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Initialize factory service if configured
    const network = process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    if (isFactoryConfigured(network)) {
      try {
        this.factoryService = new StellarFactoryService(network);
        logger.info('Stellar factory service initialized', {
          network,
          factoryId: this.factoryService.getFactoryId()
        });
      } catch (error) {
        logger.warn('Factory service not available', { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      logger.warn('Factory contract not configured for network', { network });
    }
  }

  /**
   * Handle a new cross-chain order that involves Stellar mainnet
   */
  async handleCrossChainOrder(order: HTLCOrder) {
    try {
      logger.info('Processing mainnet HTLC order', { orderId: order.orderId });

      // Generate secret for this order
      const secret = crypto.randomBytes(32).toString('hex');
      const secretHash = ethers.keccak256('0x' + secret);

      // Store order details
      this.activeOrders.set(order.orderId, {
        ...order,
        secret,
        secretHash,
        status: 'creating_escrow',
        created: new Date().toISOString(),
      });

      // Step 1: Create escrow on Base (source chain)
      logger.info('Creating Base escrow for source funds');
      
      // Get USDC address on Base
      const baseUSDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      const baseEscrowResult = await this.baseHTLC.createSourceEscrow({
        token: baseUSDC,
        amount: order.amount,
        secretHash,
        timelock: Math.floor(Date.now() / 1000) + 7200, // 2 hours
        maker: order.maker, // User who deposits USDC
        taker: process.env.RESOLVER_ADDRESS!, // Resolver who will claim
        orderHash: ethers.zeroPadValue(order.orderId, 32) // Pad orderId to bytes32
      });

      if (!baseEscrowResult.success) {
        throw new Error(`Failed to create Base escrow: ${baseEscrowResult.error}`);
      }

      // Update order with Base escrow info
      this.activeOrders.set(order.orderId, {
        ...this.activeOrders.get(order.orderId),
        baseEscrow: {
          address: baseEscrowResult.escrowAddress,
          explorerUrl: baseEscrowResult.explorerUrl,
        },
      });

      // Step 2: Deploy and initialize new HTLC contract on Stellar mainnet
      logger.info('Creating Stellar HTLC for destination funds');
      
      // In cross-chain swaps:
      // - Stellar "maker" is the user who will receive funds (stellarReceiver)
      // - Stellar "taker" is the resolver who provides liquidity
      const stellarMaker = order.stellarReceiver || process.env.DEMO_STELLAR_USER!;
      const stellarTaker = process.env.DEMO_STELLAR_RESOLVER!;
      
      logger.info('Using Stellar addresses:', {
        maker: stellarMaker,
        taker: stellarTaker,
      });
      
      // Convert amount from stroops to XLM
      const amountInStroops = parseFloat(order.amount);
      const amountInXLM = (amountInStroops / 10000000).toFixed(7);
      
      let escrowResult: any;
      
      // Use factory service if available
      // Create escrow parameters outside try block so it's available in error handler
      let escrowParams: EscrowParams | undefined;
      
      if (this.factoryService && this.deployerKeypair) {
        logger.info('Using factory to deploy new HTLC escrow...');
        
        try {
          // Calculate timelocks (packed into u64)
          const currentTime = Math.floor(Date.now() / 1000);
          const timelocks = this.packTimelocks({
            srcWithdrawal: currentTime + 3600, // 1 hour
            srcPublicWithdrawal: currentTime + 7200, // 2 hours
            srcCancellation: currentTime + 10800, // 3 hours
            srcPublicCancellation: currentTime + 14400, // 4 hours
            dstWithdrawal: currentTime + 1800, // 30 minutes
            dstPublicWithdrawal: currentTime + 3600, // 1 hour
            dstCancellation: currentTime + 5400, // 1.5 hours
            dstPublicCancellation: currentTime + 7200, // 2 hours
          });
          
          // Get token address (native XLM for now)
          const stellarContracts = getStellarContracts(process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet');
          const tokenAddress = stellarContracts.nativeToken;
          
          // Create escrow parameters
          escrowParams = {
            orderHash: crypto.randomBytes(32).toString('hex'), // Generate unique order hash
            hashlock: secretHash,
            maker: stellarMaker,
            taker: stellarTaker,
            token: tokenAddress,
            amount: amountInStroops.toString(),
            safetyDeposit: '0', // No safety deposit for now
            timelocks: timelocks.toString(),
          };
          
          // First calculate the escrow address
          const escrowAddress = await this.factoryService.calculateEscrowAddress(escrowParams);
          logger.info('Calculated escrow address', { escrowAddress });
          
          // Deploy the escrow
          const deployedAddress = await this.factoryService.deployEscrow({
            ...escrowParams,
            sourceKeypair: this.deployerKeypair,
          });
          
          if (deployedAddress !== escrowAddress) {
            logger.warn('Deployed address differs from calculated', {
              calculated: escrowAddress,
              deployed: deployedAddress,
            });
          }
          
          escrowResult = {
            success: true,
            transactionHash: 'factory-deploy-' + Date.now(), // Factory returns address, not tx hash
            escrowAddress: deployedAddress,
            secret,
            secretHash,
          };
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Factory deployment failed', { error: errorMessage });
          
          // Check if it's an "already deployed" error
          if (errorMessage.includes('AlreadyDeployed') || errorMessage.includes('UnreachableCodeReached')) {
            logger.info('Escrow may already exist, attempting to generate new unique parameters');
            
            // Try with a new unique order hash by adding timestamp
            const uniqueOrderHash = crypto.randomBytes(32).toString('hex');
            const newParams: EscrowParams = {
              ...escrowParams,
              orderHash: uniqueOrderHash,
            };
            
            try {
              // Try deployment with new unique hash
              const retryAddress = await this.factoryService.deployEscrow({
                ...newParams,
                sourceKeypair: this.deployerKeypair,
              });
              
              escrowResult = {
                success: true,
                transactionHash: 'factory-deploy-retry-' + Date.now(),
                escrowAddress: retryAddress,
                secret,
                secretHash,
              };
            } catch (retryError) {
              logger.error('Retry deployment also failed', { 
                error: retryError instanceof Error ? retryError.message : String(retryError) 
              });
              throw new Error('Failed to deploy Stellar escrow after retry');
            }
          } else {
            // For other errors, throw
            throw new Error(`Factory deployment failed: ${errorMessage}`);
          }
        }
      } else {
        // No factory available
        throw new Error('Stellar factory service not available - check configuration');
      }

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
          base: {
            escrowAddress: baseEscrowResult.escrowAddress,
            explorerUrl: baseEscrowResult.explorerUrl,
          },
          stellar: {
            escrowAddress: escrowResult.escrowAddress,
            transactionHash: escrowResult.transactionHash,
            explorerUrl: `https://stellar.expert/explorer/public/tx/${escrowResult.transactionHash}`,
          },
          escrowAddresses: {
            base: baseEscrowResult.escrowAddress,
            stellar: escrowResult.escrowAddress,
          },
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
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if we should use real mainnet transactions
   */
  shouldUseMainnet(): boolean {
    return process.env.STELLAR_NETWORK === 'mainnet';
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
      created: order.created,
      error: order.error,
      secret: order.status === 'completed' ? order.secret : undefined, // Only reveal secret when completed
      ethereum: order.ethereumHTLC,
      stellar: {
        escrowAddress: order.escrowAddress,
        transactionHash: order.stellarTxHash,
        explorerUrl: order.explorerUrl,
      },
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

  /**
   * Pack timelocks into a single u64 value
   * Each timelock is 8 bits (0-255 hours from base time)
   */
  private packTimelocks(timelocks: {
    srcWithdrawal: number;
    srcPublicWithdrawal: number;
    srcCancellation: number;
    srcPublicCancellation: number;
    dstWithdrawal: number;
    dstPublicWithdrawal: number;
    dstCancellation: number;
    dstPublicCancellation: number;
  }): bigint {
    const baseTime = Math.floor(Date.now() / 1000);
    
    // Convert absolute timestamps to hours from base time
    const toHours = (timestamp: number) => Math.min(255, Math.floor((timestamp - baseTime) / 3600));
    
    // Pack into u64 (8 bytes, each timelock gets 1 byte)
    return BigInt(toHours(timelocks.srcWithdrawal)) |
           (BigInt(toHours(timelocks.srcPublicWithdrawal)) << BigInt(8)) |
           (BigInt(toHours(timelocks.srcCancellation)) << BigInt(16)) |
           (BigInt(toHours(timelocks.srcPublicCancellation)) << BigInt(24)) |
           (BigInt(toHours(timelocks.dstWithdrawal)) << BigInt(32)) |
           (BigInt(toHours(timelocks.dstPublicWithdrawal)) << BigInt(40)) |
           (BigInt(toHours(timelocks.dstCancellation)) << BigInt(48)) |
           (BigInt(toHours(timelocks.dstPublicCancellation)) << BigInt(56));
  }
}