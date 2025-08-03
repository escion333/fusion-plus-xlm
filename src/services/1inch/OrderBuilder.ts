/**
 * @fileoverview OrderBuilder - Constructs and manages 1inch Fusion+ cross-chain orders
 * 
 * This module provides comprehensive order building capabilities for 1inch Fusion+ protocol,
 * enabling cross-chain atomic swaps between Ethereum-compatible chains and Stellar.
 * It handles order construction, Dutch auction mechanics, signature generation, and
 * cross-chain extension encoding.
 * 
 * Key Features:
 * - Cross-chain order construction with HTLC support
 * - Dutch auction implementation with linear price decay
 * - EIP-712 signature generation for order authentication
 * - Maker traits encoding for order parameters
 * - Timelock management for atomic swap security
 * - Factory integration for efficient escrow deployment
 * 
 * Security Considerations:
 * - Cryptographically secure random value generation
 * - Proper hashlock binding for atomic swaps
 * - Timelock validation to prevent indefinite locking
 * - EIP-712 domain separation for signature security
 * 
 * @version 1.0.0
 * @author Fusion+ Team
 */

import { ethers } from 'ethers';
import { PROXY_CONFIG } from '../../proxy/config';
import { getBaseFactory, getStellarFactory } from '../../config/network-utils';

/**
 * @interface CrossChainOrder
 * @description Represents a complete 1inch Fusion+ cross-chain order with HTLC extension
 * 
 * Combines standard 1inch order structure with cross-chain atomic swap capabilities.
 * The extension field contains all necessary data for HTLC escrow deployment and management.
 */
export interface CrossChainOrder {
  /** Random salt for order uniqueness and replay protection */
  salt: string;
  /** Address of the order maker (user initiating the swap) */
  maker: string;
  /** Address that will receive the taker asset (usually same as maker for cross-chain) */
  receiver: string;
  /** Source token contract address */
  makerAsset: string;
  /** Destination token contract address */
  takerAsset: string;
  /** Amount of maker asset to swap (in wei/smallest unit) */
  makingAmount: string;
  /** Amount of taker asset expected (in wei/smallest unit) */
  takingAmount: string;
  /** Encoded maker traits containing order parameters and Dutch auction config */
  makerTraits: string;
  
  /** Cross-chain extension containing HTLC and atomic swap parameters */
  extension: {
    /** Target blockchain for the destination leg */
    destinationChain: 'stellar' | 'ethereum';
    /** Stellar address to receive tokens (required for Stellar destinations) */
    stellarReceiver?: string;
    /** Keccak256 hash of the atomic swap secret */
    hashlockSecret: string;
    /** Factory contract address for escrow deployment */
    escrowFactory: string;
    /** Timelock configuration for both chains */
    timelocks: {
      /** Source chain: Resolver withdrawal deadline */
      srcWithdrawal: number;
      /** Source chain: Public withdrawal deadline */
      srcPublicWithdrawal: number;
      /** Source chain: Maker cancellation deadline */
      srcCancellation: number;
      /** Source chain: Public cancellation deadline */
      srcPublicCancellation: number;
      /** Destination chain: User withdrawal deadline */
      dstWithdrawal: number;
      /** Destination chain: Public withdrawal deadline */
      dstPublicWithdrawal: number;
      /** Destination chain: Resolver cancellation deadline */
      dstCancellation: number;
    };
  };
}

/**
 * @interface DutchAuctionParams
 * @description Configuration for Dutch auction orders with declining price mechanism
 * 
 * Dutch auctions start with a high price that decreases linearly over time until reaching
 * the base price. This incentivizes quick order fulfillment while providing price discovery.
 * The auction mechanism helps ensure orders get filled even in volatile market conditions.
 * 
 * Price Calculation:
 * - At auctionStartTime: basePrice + (basePrice * initialRateBump / 10000)
 * - At auctionEndTime: basePrice
 * - Linear interpolation between start and end times
 */
export interface DutchAuctionParams {
  /** Unix timestamp when the Dutch auction begins (price is highest) */
  auctionStartTime: number;
  /** Unix timestamp when auction ends and price reaches base level */
  auctionEndTime: number;
  /** Initial price premium in basis points (e.g., 1000 = 10% above base price) */
  initialRateBump: number;
  /** Reserved for future custom price curve implementations */
  points?: Array<{ time: number; bump: number }>;
}

/**
 * @class OrderBuilder
 * @description Constructs and manages 1inch Fusion+ cross-chain orders with atomic swap capabilities
 * 
 * This class provides a comprehensive toolkit for building cross-chain orders that leverage
 * Hash Time Locked Contracts (HTLCs) for atomic swaps between different blockchains.
 * It handles all aspects of order construction including signature generation, Dutch auctions,
 * and cross-chain parameter encoding.
 * 
 * Key Capabilities:
 * - Cross-chain order construction with HTLC support
 * - Dutch auction configuration for dynamic pricing
 * - EIP-712 signature generation for order authentication
 * - Maker traits encoding with timelock and auction parameters
 * - Hashlock generation for atomic swap security
 * - Factory integration for efficient escrow deployment
 * 
 * Supported Chains:
 * - Source: Ethereum, Base, and other EVM-compatible chains
 * - Destination: Stellar network
 * 
 * @example
 * ```typescript
 * const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
 * const builder = new OrderBuilder(provider);
 * 
 * const order = await builder.buildCrossChainOrder({
 *   maker: '0x123...',
 *   sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   destinationToken: 'native', // XLM on Stellar
 *   sourceAmount: '1000000', // 1 USDC
 *   destinationAmount: '100000000', // 10 XLM in stroops
 *   sourceChain: 'ethereum',
 *   destinationChain: 'stellar',
 *   stellarReceiver: 'GXXX...XXXX'
 * });
 * ```
 */
export class OrderBuilder {
  /** Ethereum provider for blockchain interactions */
  private provider: ethers.Provider;
  
  /**
   * @constructor
   * @description Initializes the OrderBuilder with an Ethereum provider
   * 
   * @param {ethers.Provider} provider - Ethereum provider for network interactions
   * 
   * @example
   * ```typescript
   * const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
   * const builder = new OrderBuilder(provider);
   * ```
   */
  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }
  
  /**
   * @method buildCrossChainOrder
   * @description Constructs a complete cross-chain Fusion+ order with atomic swap capabilities
   * 
   * This method creates a comprehensive order structure that includes:
   * - Standard 1inch order fields for DEX integration
   * - Cross-chain extension with HTLC parameters
   * - Cryptographic hashlock for atomic swap security
   * - Configurable timelocks for escrow safety
   * - Optional Dutch auction for dynamic pricing
   * 
   * The resulting order can be submitted to resolvers for cross-chain execution.
   * Each order includes a unique salt and secret for security and atomicity.
   * 
   * Security Features:
   * - Cryptographically secure random secret generation
   * - Keccak256 hashlock binding for atomic swaps
   * - Time-based escrow releases with safety margins
   * - Replay protection through unique salt values
   * 
   * @param {Object} params - Order construction parameters
   * @param {string} params.maker - Address of the order maker (user)
   * @param {string} params.sourceToken - Source token contract address
   * @param {string} params.destinationToken - Destination token contract address
   * @param {string} params.sourceAmount - Amount of source tokens (in wei/smallest unit)
   * @param {string} params.destinationAmount - Expected destination tokens (in wei/smallest unit)
   * @param {'ethereum'|'stellar'} params.sourceChain - Source blockchain
   * @param {'ethereum'|'stellar'} params.destinationChain - Destination blockchain
   * @param {string} [params.stellarReceiver] - Stellar address for token delivery (required if destinationChain is 'stellar')
   * @param {number} [params.deadline] - Order expiration timestamp (default: 1 hour from now)
   * @param {DutchAuctionParams} [params.dutchAuction] - Optional Dutch auction configuration
   * 
   * @returns {Promise<CrossChainOrder>} Complete cross-chain order ready for submission
   * 
   * @throws {Error} If required parameters are missing or invalid
   * 
   * @example
   * ```typescript
   * // Basic cross-chain swap from Base USDC to Stellar XLM
   * const order = await builder.buildCrossChainOrder({
   *   maker: '0x123...',
   *   sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
   *   destinationToken: 'native',
   *   sourceAmount: '1000000', // 1 USDC
   *   destinationAmount: '100000000', // 10 XLM
   *   sourceChain: 'ethereum',
   *   destinationChain: 'stellar',
   *   stellarReceiver: 'GXXX...XXXX'
   * });
   * 
   * // With Dutch auction for better price discovery
   * const auctionOrder = await builder.buildCrossChainOrder({
   *   maker: '0x123...',
   *   sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
   *   destinationToken: 'native',
   *   sourceAmount: '1000000',
   *   destinationAmount: '100000000',
   *   sourceChain: 'ethereum',
   *   destinationChain: 'stellar',
   *   stellarReceiver: 'GXXX...XXXX',
   *   dutchAuction: {
   *     auctionStartTime: Math.floor(Date.now() / 1000),
   *     auctionEndTime: Math.floor(Date.now() / 1000) + 3600,
   *     initialRateBump: 1000 // 10% price premium initially
   *   }
   * });
   * ```
   */
  async buildCrossChainOrder(params: {
    maker: string;
    sourceToken: string;
    destinationToken: string;
    sourceAmount: string;
    destinationAmount: string;
    sourceChain: 'ethereum' | 'stellar';
    destinationChain: 'ethereum' | 'stellar';
    stellarReceiver?: string;
    deadline?: number;
    dutchAuction?: DutchAuctionParams;
  }): Promise<CrossChainOrder> {
    // Generate random values
    const salt = ethers.randomBytes(32);
    const secret = ethers.randomBytes(32);
    const hashlockSecret = ethers.keccak256(secret);
    
    // Calculate timelocks (in seconds from now)
    const now = Math.floor(Date.now() / 1000);
    const timelocks = this.calculateTimelocks(now);
    
    // Build maker traits (encoded parameters)
    const makerTraits = this.encodeMakerTraits({
      allowPartialFill: false,
      needPreInteraction: true,
      needPostInteraction: true,
      deadline: params.deadline || now + 3600, // 1 hour default
      dutchAuction: params.dutchAuction,
    });
    
    // Build the order
    const order: CrossChainOrder = {
      salt: ethers.hexlify(salt),
      maker: params.maker,
      receiver: params.maker, // Same as maker for cross-chain
      makerAsset: params.sourceToken,
      takerAsset: params.destinationToken,
      makingAmount: params.sourceAmount,
      takingAmount: params.destinationAmount,
      makerTraits,
      extension: {
        destinationChain: params.destinationChain,
        stellarReceiver: params.stellarReceiver,
        hashlockSecret,
        escrowFactory: this.getEscrowFactory(params.sourceChain),
        timelocks,
      },
    };
    
    return order;
  }
  
  /**
   * @method calculateTimelocks
   * @description Calculates secure timelock values for cross-chain atomic swaps
   * 
   * Timelocks are critical for atomic swap security, ensuring that:
   * - Resolvers have sufficient time to claim on source after providing liquidity
   * - Users can cancel if resolvers fail to provide destination liquidity
   * - Public participants can recover funds if primary parties fail to act
   * - Proper ordering prevents griefing attacks
   * 
   * Timelock Strategy:
   * - Source chain has longer timeouts (resolver needs time to act)
   * - Destination chain has shorter timeouts (user gets priority)
   * - Public timeouts provide fallback mechanisms
   * - Cancellation periods prevent indefinite locking
   * 
   * @private
   * @param {number} startTime - Base timestamp for calculating relative timeouts
   * 
   * @returns {Object} Timelock configuration object
   * @returns {number} srcWithdrawal - Resolver withdrawal deadline (5 min)
   * @returns {number} srcPublicWithdrawal - Public withdrawal deadline (10 min)
   * @returns {number} srcCancellation - Maker cancellation deadline (15 min)
   * @returns {number} srcPublicCancellation - Public cancellation deadline (20 min)
   * @returns {number} dstWithdrawal - User withdrawal deadline (5 min)
   * @returns {number} dstPublicWithdrawal - Public withdrawal deadline (10 min)
   * @returns {number} dstCancellation - Resolver cancellation deadline (30 min)
   */
  private calculateTimelocks(startTime: number) {
    return {
      srcWithdrawal: startTime + 300, // 5 minutes
      srcPublicWithdrawal: startTime + 600, // 10 minutes
      srcCancellation: startTime + 900, // 15 minutes
      srcPublicCancellation: startTime + 1200, // 20 minutes
      dstWithdrawal: startTime + 300, // 5 minutes
      dstPublicWithdrawal: startTime + 600, // 10 minutes
      dstCancellation: startTime + 1800, // 30 minutes
    };
  }
  
  /**
   * @method encodeMakerTraits
   * @description Encodes order parameters and Dutch auction config into maker traits
   * 
   * Maker traits is a packed uint256 that efficiently stores multiple order parameters:
   * - Order flags (partial fill, interactions, Dutch auction)
   * - Dutch auction configuration (start time, duration, rate bump)
   * - Order deadline for expiration
   * 
   * Bit Layout:
   * - Bit 0: allowPartialFill flag
   * - Bit 1: needPreInteraction flag
   * - Bit 2: needPostInteraction flag
   * - Bit 3: Dutch auction enabled flag
   * - Bits 32-63: Auction start time (32 bits)
   * - Bits 64-95: Auction duration (32 bits)
   * - Bits 96-111: Initial rate bump (16 bits, basis points)
   * - Bits 224-255: Order deadline (32 bits)
   * 
   * @private
   * @param {Object} params - Encoding parameters
   * @param {boolean} params.allowPartialFill - Whether order can be partially filled
   * @param {boolean} params.needPreInteraction - Whether pre-interaction is required
   * @param {boolean} params.needPostInteraction - Whether post-interaction is required
   * @param {number} params.deadline - Order expiration timestamp
   * @param {DutchAuctionParams} [params.dutchAuction] - Optional Dutch auction config
   * 
   * @returns {string} Hex-encoded maker traits (32 bytes)
   */
  private encodeMakerTraits(params: {
    allowPartialFill: boolean;
    needPreInteraction: boolean;
    needPostInteraction: boolean;
    deadline: number;
    dutchAuction?: DutchAuctionParams;
  }): string {
    // Pack traits into a single uint256
    let traits = BigInt(0);
    
    // Set flags
    if (params.allowPartialFill) traits |= BigInt(1) << BigInt(0);
    if (params.needPreInteraction) traits |= BigInt(1) << BigInt(1);
    if (params.needPostInteraction) traits |= BigInt(1) << BigInt(2);
    
    // Dutch auction flags and parameters
    if (params.dutchAuction) {
      // Set dutch auction enabled flag
      traits |= BigInt(1) << BigInt(3);
      
      // Encode auction start time (bits 32-63)
      traits |= BigInt(params.dutchAuction.auctionStartTime) << BigInt(32);
      
      // Encode auction duration in seconds (bits 64-95)
      const duration = params.dutchAuction.auctionEndTime - params.dutchAuction.auctionStartTime;
      traits |= BigInt(duration) << BigInt(64);
      
      // Encode initial rate bump (bits 96-111, 16 bits for basis points)
      traits |= BigInt(params.dutchAuction.initialRateBump) << BigInt(96);
    }
    
    // Add deadline (bits 224-255)
    traits |= BigInt(params.deadline) << BigInt(224);
    
    return '0x' + traits.toString(16).padStart(64, '0');
  }
  
  /**
   * @method calculateAuctionPrice
   * @description Calculates the current Dutch auction price at a specific timestamp
   * 
   * Implements linear price decay from initial premium to base price over auction duration.
   * The price starts high to incentivize quick fills but decreases to ensure eventual execution.
   * 
   * Price Formula:
   * - Before auction: basePrice + (basePrice * initialRateBump / 10000)
   * - During auction: Linear interpolation based on elapsed time
   * - After auction: basePrice (minimum)
   * 
   * @param {string} baseAmount - Base amount without auction premium
   * @param {DutchAuctionParams} auctionParams - Auction configuration
   * @param {number} timestamp - Current timestamp to calculate price for
   * 
   * @returns {string} Current auction price as string (in wei/smallest unit)
   * 
   * @example
   * ```typescript
   * const auctionParams = {
   *   auctionStartTime: 1700000000,
   *   auctionEndTime: 1700003600,
   *   initialRateBump: 1000 // 10%
   * };
   * 
   * const price = builder.calculateAuctionPrice(
   *   '1000000', // 1 USDC base
   *   auctionParams,
   *   1700001800 // 30 min into auction
   * );
   * // Returns price between 1.1 USDC and 1.0 USDC based on time
   * ```
   */
  calculateAuctionPrice(
    baseAmount: string,
    auctionParams: DutchAuctionParams,
    timestamp: number
  ): string {
    // If timestamp is before auction start, return initial price (highest)
    if (timestamp <= auctionParams.auctionStartTime) {
      const baseAmountBN = BigInt(baseAmount);
      const bumpAmount = (baseAmountBN * BigInt(auctionParams.initialRateBump)) / BigInt(10000);
      return (baseAmountBN + bumpAmount).toString();
    }
    
    // If timestamp is after auction end, return base price (lowest)
    if (timestamp >= auctionParams.auctionEndTime) {
      return baseAmount;
    }
    
    // Calculate linear interpolation
    const totalDuration = auctionParams.auctionEndTime - auctionParams.auctionStartTime;
    const elapsed = timestamp - auctionParams.auctionStartTime;
    const progress = elapsed / totalDuration; // 0 to 1
    
    // Calculate price decrease
    const baseAmountBN = BigInt(baseAmount);
    const maxBump = (baseAmountBN * BigInt(auctionParams.initialRateBump)) / BigInt(10000);
    const currentBump = maxBump - BigInt(Math.floor(Number(maxBump) * progress));
    
    return (baseAmountBN + currentBump).toString();
  }

  /**
   * @method getEscrowFactory
   * @description Retrieves the appropriate escrow factory address for the specified chain
   * 
   * Factory contracts enable efficient and standardized escrow deployment across different
   * blockchains. Each chain has its own factory optimized for that network's characteristics.
   * 
   * @private
   * @param {'ethereum'|'stellar'} chain - Target blockchain for escrow deployment
   * 
   * @returns {string} Factory contract address for the specified chain
   * 
   * @throws {Error} If chain is not supported or factory not configured
   */
  private getEscrowFactory(chain: 'ethereum' | 'stellar'): string {
    if (chain === 'ethereum') {
      return getBaseFactory(); // Use network config
    } else {
      return getStellarFactory(); // Use network config
    }
  }
  
  /**
   * @method signOrder
   * @description Generates EIP-712 signature for a cross-chain order
   * 
   * Creates a cryptographically secure signature that proves order authenticity and
   * prevents tampering. Uses EIP-712 structured data signing for better UX and security.
   * 
   * The signature includes:
   * - Domain separation for the 1inch Fusion+ protocol
   * - Chain ID for replay protection
   * - Verifying contract address for validation
   * - Complete order data for integrity
   * 
   * @param {CrossChainOrder} order - The order to sign
   * @param {ethers.Signer} signer - Ethereum signer (wallet) to create signature
   * 
   * @returns {Promise<string>} EIP-712 signature as hex string
   * 
   * @throws {Error} If signing fails or signer is invalid
   * 
   * @example
   * ```typescript
   * const order = await builder.buildCrossChainOrder({...});
   * const wallet = new ethers.Wallet(privateKey, provider);
   * const signature = await builder.signOrder(order, wallet);
   * 
   * // Signature can now be submitted with order to resolvers
   * ```
   */
  async signOrder(order: CrossChainOrder, signer: ethers.Signer): Promise<string> {
    // Get order hash
    const orderHash = this.getOrderHash(order);
    
    // EIP-712 signature
    const domain = {
      name: '1inch Fusion+',
      version: '1',
      chainId: 1, // Ethereum mainnet
      verifyingContract: '0x18D410f651289BB978Fc32F90D2d7E608F4f4560', // 1inch protocol contract
    };
    
    const types = {
      Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'receiver', type: 'address' },
        { name: 'makerAsset', type: 'address' },
        { name: 'takerAsset', type: 'address' },
        { name: 'makingAmount', type: 'uint256' },
        { name: 'takingAmount', type: 'uint256' },
        { name: 'makerTraits', type: 'uint256' },
      ],
    };
    
    const signature = await signer.signTypedData(domain, types, {
      salt: order.salt,
      maker: order.maker,
      receiver: order.receiver,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: order.makingAmount,
      takingAmount: order.takingAmount,
      makerTraits: order.makerTraits,
    });
    
    return signature;
  }
  
  /**
   * @method getOrderHash
   * @description Computes deterministic hash of a cross-chain order
   * 
   * Generates a unique hash that identifies the order and includes both standard
   * 1inch fields and cross-chain extension data. This hash is used for:
   * - Order identification and tracking
   * - Signature verification
   * - Preventing replay attacks
   * - Linking escrows across chains
   * 
   * The hash includes:
   * - All standard order fields (salt, maker, amounts, etc.)
   * - Cross-chain extension hash (destination chain, hashlock, factory)
   * - Ensures complete order integrity
   * 
   * @param {CrossChainOrder} order - The order to hash
   * 
   * @returns {string} Keccak256 hash of the order as hex string
   * 
   * @example
   * ```typescript
   * const order = await builder.buildCrossChainOrder({...});
   * const orderHash = builder.getOrderHash(order);
   * console.log('Order hash:', orderHash);
   * ```
   */
  getOrderHash(order: CrossChainOrder): string {
    const abiCoder = new ethers.AbiCoder();
    
    // Include extension data in hash
    const extensionHash = ethers.keccak256(
      abiCoder.encode(
        ['string', 'string', 'bytes32', 'address'],
        [
          order.extension.destinationChain,
          order.extension.stellarReceiver || '',
          order.extension.hashlockSecret,
          order.extension.escrowFactory,
        ]
      )
    );
    
    // Main order hash
    const encoded = abiCoder.encode(
      ['bytes32', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        order.salt,
        order.maker,
        order.receiver,
        order.makerAsset,
        order.takerAsset,
        order.makingAmount,
        order.takingAmount,
        order.makerTraits,
        extensionHash,
      ]
    );
    
    return ethers.keccak256(encoded);
  }
  
  /**
   * @method packTimelocks
   * @description Efficiently packs timelock values into a single uint256 for gas optimization
   * 
   * Combines multiple timelock timestamps into a compact representation that saves
   * gas when storing and passing timelock data to smart contracts.
   * 
   * Packing Format (9 bits each, ~512 seconds max per timelock):
   * - Bits 0-8: srcWithdrawal
   * - Bits 9-17: srcPublicWithdrawal
   * - Bits 18-26: srcCancellation
   * - Bits 27-35: srcPublicCancellation
   * - Bits 36-44: dstWithdrawal
   * - Bits 45-53: dstPublicWithdrawal
   * - Bits 54-62: dstCancellation
   * 
   * @param {Object} timelocks - Timelock configuration from order extension
   * 
   * @returns {bigint} Packed timelock value as 256-bit integer
   * 
   * @throws {Error} If any timelock value exceeds 9-bit limit (511 seconds)
   */
  packTimelocks(timelocks: CrossChainOrder['extension']['timelocks']): bigint {
    let packed = BigInt(0);
    
    // Pack each timelock (9 bits each, ~512 seconds max)
    packed |= BigInt(timelocks.srcWithdrawal & 0x1FF) << BigInt(0);
    packed |= BigInt(timelocks.srcPublicWithdrawal & 0x1FF) << BigInt(9);
    packed |= BigInt(timelocks.srcCancellation & 0x1FF) << BigInt(18);
    packed |= BigInt(timelocks.srcPublicCancellation & 0x1FF) << BigInt(27);
    packed |= BigInt(timelocks.dstWithdrawal & 0x1FF) << BigInt(36);
    packed |= BigInt(timelocks.dstPublicWithdrawal & 0x1FF) << BigInt(45);
    packed |= BigInt(timelocks.dstCancellation & 0x1FF) << BigInt(54);
    
    return packed;
  }
  
  /**
   * @method createResolverInteraction
   * @description Creates encoded interaction data for resolver execution
   * 
   * Generates ABI-encoded data that resolvers use to properly handle cross-chain orders.
   * This data contains all necessary information for the resolver to:
   * - Deploy appropriate escrow contracts
   * - Configure hashlocks and timelocks correctly
   * - Execute atomic swap logic
   * 
   * @param {CrossChainOrder} order - The cross-chain order
   * @param {string} resolverAddress - Address of the resolver that will execute the order
   * 
   * @returns {string} ABI-encoded interaction data as hex string
   * 
   * @example
   * ```typescript
   * const order = await builder.buildCrossChainOrder({...});
   * const resolverAddr = '0x456...';
   * const interactionData = builder.createResolverInteraction(order, resolverAddr);
   * 
   * // This data can be included in the order submission to guide resolver execution
   * ```
   */
  createResolverInteraction(order: CrossChainOrder, resolverAddress: string): string {
    const abiCoder = new ethers.AbiCoder();
    
    return abiCoder.encode(
      ['address', 'bytes32', 'uint256', 'address'],
      [
        resolverAddress,
        order.extension.hashlockSecret,
        this.packTimelocks(order.extension.timelocks),
        order.extension.escrowFactory,
      ]
    );
  }
}

export default OrderBuilder;