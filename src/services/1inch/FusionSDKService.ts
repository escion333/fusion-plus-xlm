import { FusionSDK, NetworkEnum, PrivateKeyProviderConnector } from '@1inch/fusion-sdk';
import { ethers } from 'ethers';
import { PROXY_CONFIG } from '../../proxy/config';

export interface FusionOrderParams {
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  maker: string;
  receiver?: string;
  deadline?: number;
  partialFillAllowed?: boolean;
}

export interface CrossChainOrderParams extends FusionOrderParams {
  destinationChain: 'stellar' | 'ethereum';
  stellarReceiver?: string;
  hashlockSecret?: string;
}

export class FusionSDKService {
  private sdk: FusionSDK;
  private provider: ethers.Provider;
  
  constructor(
    provider: ethers.Provider,
    privateKey?: string,
    network: NetworkEnum = NetworkEnum.ETHEREUM
  ) {
    this.provider = provider;
    
    // Initialize SDK with provider
    const providerConnector = privateKey
      ? new PrivateKeyProviderConnector(privateKey, provider as any)
      : undefined;
    
    this.sdk = new FusionSDK({
      url: PROXY_CONFIG.fusion.baseUrl,
      network,
      authKey: process.env.ONEINCH_API_KEY,
      // @ts-ignore - Type mismatch with SDK
      provider: providerConnector,
    });
  }
  
  /**
   * Create a cross-chain Fusion+ order
   */
  async createCrossChainOrder(params: CrossChainOrderParams): Promise<any> {
    try {
      // Build the base order
      const orderParams = {
        makerAsset: params.makerAsset,
        takerAsset: params.takerAsset,
        makingAmount: params.makingAmount,
        takingAmount: params.takingAmount,
        maker: params.maker,
        receiver: params.receiver || params.maker,
        deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
      };
      
      // Add cross-chain specific data
      const crossChainData = this.encodeCrossChainData({
        destinationChain: params.destinationChain,
        stellarReceiver: params.stellarReceiver,
        hashlockSecret: params.hashlockSecret,
      });
      
      // Create the order with cross-chain extension
      const order = await this.sdk.createOrder({
        ...orderParams,
        // @ts-ignore - Extension data
        extension: crossChainData,
      });
      
      return order;
    } catch (error) {
      console.error('Error creating cross-chain order:', error);
      throw error;
    }
  }
  
  /**
   * Encode cross-chain specific data for the order
   */
  private encodeCrossChainData(data: {
    destinationChain: string;
    stellarReceiver?: string;
    hashlockSecret?: string;
  }): string {
    // Encode cross-chain parameters
    const abiCoder = new ethers.AbiCoder();
    
    return abiCoder.encode(
      ['string', 'string', 'bytes32'],
      [
        data.destinationChain,
        data.stellarReceiver || '',
        data.hashlockSecret || ethers.zeroPadValue('0x', 32),
      ]
    );
  }
  
  /**
   * Get active orders
   */
  async getActiveOrders(maker?: string): Promise<any[]> {
    try {
      const params = maker ? new URLSearchParams({ maker }) : new URLSearchParams();
      const response = await fetch(
        `${PROXY_CONFIG.fusion.baseUrl}${PROXY_CONFIG.fusion.endpoints.orders.active}?${params}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }
      
      const data: any = await response.json();
      return data.orders || data || [];
    } catch (error) {
      console.error('Error fetching active orders:', error);
      // Return mock data if API fails
      return this.getMockActiveOrders(maker);
    }
  }
  
  /**
   * Get order status
   */
  async getOrderStatus(orderHash: string): Promise<any> {
    try {
      const response = await fetch(
        `${PROXY_CONFIG.fusion.baseUrl}${PROXY_CONFIG.fusion.endpoints.orders.status}/${orderHash}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order status: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error fetching order status:', error);
      // Return mock status
      return {
        orderHash,
        status: 'open',
        fills: [],
        createdAt: new Date().toISOString(),
      };
    }
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(orderHash: string, signature: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${PROXY_CONFIG.fusion.baseUrl}${PROXY_CONFIG.fusion.endpoints.orders.cancel}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
          },
          body: JSON.stringify({ orderHash, signature }),
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Error canceling order:', error);
      return false;
    }
  }
  
  /**
   * Get quote for cross-chain swap
   */
  async getQuote(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChain: 'ethereum' | 'stellar';
    toChain: 'ethereum' | 'stellar';
  }): Promise<any> {
    try {
      // For cross-chain quotes, we need to calculate based on both chains
      if (params.fromChain !== params.toChain) {
        // Return mock cross-chain quote
        return {
          fromToken: params.fromToken,
          toToken: params.toToken,
          fromAmount: params.amount,
          toAmount: (BigInt(params.amount) * 95n / 100n).toString(), // 5% slippage
          estimatedGas: '300000', // Higher for cross-chain
          protocols: [['CROSS_CHAIN_FUSION']],
          crossChain: true,
        };
      }
      
      // Same chain quote
      const response = await fetch(
        `${PROXY_CONFIG.fusion.baseUrl}${PROXY_CONFIG.fusion.endpoints.quoter}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromTokenAddress: params.fromToken,
            toTokenAddress: params.toToken,
            amount: params.amount,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get quote: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error getting quote:', error);
      // Return mock quote
      return {
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.amount,
        toAmount: (BigInt(params.amount) * 2n).toString(), // Mock 2x rate
        estimatedGas: '150000',
        protocols: [['UNISWAP_V3']],
      };
    }
  }
  
  /**
   * Get mock active orders for demo
   */
  private getMockActiveOrders(maker?: string): any[] {
    return [
      {
        orderHash: '0x' + '1'.repeat(64),
        maker: maker || '0x' + '2'.repeat(40),
        makerAsset: PROXY_CONFIG.tokens.ethereum.USDC,
        takerAsset: PROXY_CONFIG.tokens.ethereum.WETH,
        makingAmount: '1000000000', // 1000 USDC
        takingAmount: '500000000000000000', // 0.5 ETH
        deadline: Math.floor(Date.now() / 1000) + 3600,
        status: 'open',
        crossChain: {
          enabled: true,
          destinationChain: 'stellar',
          stellarReceiver: 'GB3MTYFXPBZBUINVG72XR7AQ6P2I32CYSXWNRKJ2PV5LU5XNJCLE7HT',
        },
      },
    ];
  }
  
  /**
   * Build order signature
   */
  async signOrder(order: any, signer: ethers.Signer): Promise<string> {
    try {
      // Get order hash
      const orderHash = this.getOrderHash(order);
      
      // Sign the hash
      const signature = await signer.signMessage(ethers.getBytes(orderHash));
      
      return signature;
    } catch (error) {
      console.error('Error signing order:', error);
      throw error;
    }
  }
  
  /**
   * Calculate order hash
   */
  private getOrderHash(order: any): string {
    // Simplified order hash calculation
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(
      ['address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
      [
        order.maker,
        order.receiver,
        order.makerAsset,
        order.takerAsset,
        order.makingAmount,
        order.takingAmount,
        order.deadline,
      ]
    );
    
    return ethers.keccak256(encoded);
  }
}

export default FusionSDKService;