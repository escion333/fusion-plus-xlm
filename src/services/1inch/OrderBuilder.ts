import { ethers } from 'ethers';
import { PROXY_CONFIG } from '../../proxy/config';

export interface CrossChainOrder {
  // Standard 1inch order fields
  salt: string;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  makerTraits: string;
  
  // Cross-chain extension
  extension: {
    destinationChain: 'stellar' | 'ethereum';
    stellarReceiver?: string;
    hashlockSecret: string;
    escrowFactory: string;
    timelocks: {
      srcWithdrawal: number;
      srcPublicWithdrawal: number;
      srcCancellation: number;
      srcPublicCancellation: number;
      dstWithdrawal: number;
      dstPublicWithdrawal: number;
      dstCancellation: number;
    };
  };
}

export class OrderBuilder {
  private provider: ethers.Provider;
  
  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }
  
  /**
   * Build a cross-chain Fusion+ order
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
   * Calculate timelock values for cross-chain swap
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
   * Encode maker traits for the order
   */
  private encodeMakerTraits(params: {
    allowPartialFill: boolean;
    needPreInteraction: boolean;
    needPostInteraction: boolean;
    deadline: number;
  }): string {
    // Pack traits into a single uint256
    let traits = BigInt(0);
    
    // Set flags
    if (params.allowPartialFill) traits |= BigInt(1) << BigInt(0);
    if (params.needPreInteraction) traits |= BigInt(1) << BigInt(1);
    if (params.needPostInteraction) traits |= BigInt(1) << BigInt(2);
    
    // Add deadline (upper 32 bits)
    traits |= BigInt(params.deadline) << BigInt(224);
    
    return '0x' + traits.toString(16).padStart(64, '0');
  }
  
  /**
   * Get escrow factory address for chain
   */
  private getEscrowFactory(chain: 'ethereum' | 'stellar'): string {
    if (chain === 'ethereum') {
      return '0x18D410f651289BB978Fc32F90D2d7E608F4f4560'; // Mainnet escrow factory
    } else {
      // Stellar contract addresses are different format
      return 'GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON'; // Example
    }
  }
  
  /**
   * Sign an order
   */
  async signOrder(order: CrossChainOrder, signer: ethers.Signer): Promise<string> {
    // Get order hash
    const orderHash = this.getOrderHash(order);
    
    // EIP-712 signature
    const domain = {
      name: '1inch Fusion+',
      version: '1',
      chainId: 1, // Ethereum mainnet
      verifyingContract: PROXY_CONFIG.oneinch.baseUrl,
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
   * Calculate order hash
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
   * Pack timelocks into a single uint256
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
   * Create interaction data for resolver
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