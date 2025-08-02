import { retryQuoteFetch, retryOrderStatus } from '@/utils/retry';

const API_BASE_URL = process.env.NEXT_PUBLIC_RESOLVER_API_URL || 'http://localhost:3001';
const PROXY_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface CreateSwapRequest {
  sourceChain: string;
  destChain: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  maker: string;
  taker: string;
}

interface SwapResponse {
  id: string;
  status: string;
  sourceChain: string;
  destChain: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  maker: string;
  taker: string;
  escrowAddressSrc?: string;
  escrowAddressDst?: string;
  secret?: string;
  hashedSecret: string;
  createdAt: string;
  updatedAt: string;
}

// 1inch Fusion+ API interfaces
interface FusionOrder {
  orderHash: string;
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  deadline: number;
  status: string;
  crossChain?: {
    enabled: boolean;
    destinationChain: string;
    stellarReceiver?: string;
  };
}

interface QuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  fromChain: string;
  toChain: string;
}

interface QuoteResponse {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  protocols: string[][];
  crossChain?: boolean;
  isMockData?: boolean;
}

export class FusionAPI {
  static async getActiveOrders(maker?: string): Promise<FusionOrder[]> {
    try {
      const params = maker ? `?maker=${maker}` : '';
      const endpoint = `${PROXY_BASE_URL}/api/fusion/orders/active${params}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(`Service unavailable. Please ensure the API proxy is running on port ${PROXY_BASE_URL.split(':').pop()}`);
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a few moments.');
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}. The API service may be experiencing issues.`);
        } else if (response.status === 404) {
          throw new Error('API endpoint not found. Please check your service configuration.');
        }
        throw new Error(`Failed to fetch active orders: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.orders || [];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error: Unable to connect to API proxy at', PROXY_BASE_URL);
        return [];
      }
      console.error('Failed to fetch active orders:', error);
      return [];
    }
  }
  
  static async createOrder(order: Partial<FusionOrder>): Promise<FusionOrder> {
    try {
      const endpoint = `${PROXY_BASE_URL}/api/fusion/orders/create`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        
        if (response.status === 503) {
          throw new Error(`Service unavailable. Please ensure the API proxy is running on port ${PROXY_BASE_URL.split(':').pop()}`);
        } else if (response.status === 400) {
          throw new Error(`Invalid order parameters: ${errorData}`);
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please reconnect your wallet.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before creating another order.');
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}. The order service may be experiencing issues.`);
        }
        throw new Error(`Failed to create order: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const data = await response.json();
      return data.order || data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Cannot connect to API proxy at ${PROXY_BASE_URL}. Please ensure all services are running.`);
      }
      console.error('Failed to create order:', error);
      throw error;
    }
  }
  
  static async getOrderStatus(orderHash: string): Promise<{
    order: {
      orderHash: string;
      status: string;
      srcAmount?: string;
      dstAmount?: string;
      srcChain?: string;
      dstChain?: string;
      createdAt?: string;
    }
  }> {
    return retryOrderStatus(async () => {
      try {
        const endpoint = `${PROXY_BASE_URL}/api/fusion/orders/${orderHash}`;
          
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          const error = new Error() as Error & { status: number };
          error.status = response.status;
          
          if (response.status === 404) {
            error.message = `Order ${orderHash.slice(0, 8)}... not found. It may have expired or been cancelled.`;
          } else if (response.status === 503) {
            error.message = 'Order service temporarily unavailable. Please try again.';
          } else if (response.status >= 500) {
            error.message = 'Server error while fetching order status. Please try again later.';
          } else {
            error.message = `Failed to get order status: ${response.status} ${response.statusText}`;
          }
          throw error;
        }
        
        const data = await response.json();
        return data.order;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const netError = new Error('Network error: Unable to check order status. Please check your connection.') as Error & { status: number };
          netError.status = 0;
          throw netError;
        }
        console.error('Failed to get order status:', error);
        throw error;
      }
    });
  }
  
  static async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return retryQuoteFetch(async () => {
      try {
        const params = new URLSearchParams({
          src: request.fromToken,
          dst: request.toToken,
          amount: request.amount,
        });
        
        // Check if this is a Stellar cross-chain swap (1inch doesn't support Stellar)
        const isStellarSwap = request.fromChain === 'stellar' || request.toChain === 'stellar';
        
        if (isStellarSwap) {
          // Use our extended resolver for Stellar swaps since 1inch doesn't support Stellar
          const stellarResponse = await fetch(`${PROXY_BASE_URL}/api/fusion/quote?${params}`);
          if (!stellarResponse.ok) {
            const error = new Error() as Error & { status: number };
            error.status = stellarResponse.status;
            
            if (stellarResponse.status === 503) {
              error.message = `Stellar quote service unavailable. Ensure the API proxy is running on port ${PROXY_BASE_URL.split(':').pop()}`;
            } else if (stellarResponse.status === 400) {
              const errorText = await stellarResponse.text();
              error.message = `Invalid quote parameters: ${errorText}`;
            } else if (stellarResponse.status === 429) {
              error.message = 'Too many quote requests. Please slow down.';
            } else {
              error.message = `Failed to get Stellar quote: ${stellarResponse.status} ${stellarResponse.statusText}`;
            }
            throw error;
          }
          const stellarData = await stellarResponse.json();
          return {
            fromToken: request.fromToken,
            toToken: request.toToken,
            fromAmount: request.amount,
            toAmount: stellarData.toAmount,
            estimatedGas: stellarData.estimatedGas,
            protocols: stellarData.protocols,
            crossChain: request.fromChain !== request.toChain,
            isMockData: false
          };
        }
        
        // For non-Stellar swaps in live mode, use real 1inch API
        const response = await fetch(`${PROXY_BASE_URL}/api/1inch/quote?${params}`);
        
        if (!response.ok) {
          const errorData = await response.text();
          const error = new Error() as Error & { status: number };
          error.status = response.status;
          
          if (response.status === 503) {
            error.message = '1inch API unavailable. The proxy service may be down.';
          } else if (response.status === 400) {
            error.message = `Invalid token pair or amount: ${errorData}`;
          } else if (response.status === 429) {
            error.message = '1inch API rate limit reached. Please wait before requesting another quote.';
          } else if (response.status === 404) {
            error.message = 'Quote endpoint not found. Service configuration may be incorrect.';
          } else {
            error.message = `Failed to get quote: ${response.status} - ${errorData}`;
          }
          throw error;
        }
        
        const data = await response.json();
        return {
          fromToken: request.fromToken,
          toToken: request.toToken,
          fromAmount: request.amount,
          toAmount: data.dstAmount || data.toAmount,
          estimatedGas: data.gas || data.estimatedGas || '150000',
          protocols: data.protocols || [['ONEINCH_FUSION']],
          crossChain: request.fromChain !== request.toChain
        };
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const netError = new Error(`Cannot connect to quote service at ${PROXY_BASE_URL}. Please ensure all services are running.`) as Error & { status: number };
          netError.status = 0; // Network error
          throw netError;
        }
        console.error('Failed to get quote:', error);
        throw error;
      }
    });
  }
}

export class ResolverAPI {
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  static async createSwap(request: CreateSwapRequest): Promise<SwapResponse> {
    const response = await fetch(`${API_BASE_URL}/api/swaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create swap: ${response.statusText}`);
    }

    return response.json();
  }

  static async getSwap(swapId: string): Promise<SwapResponse> {
    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}`);

    if (!response.ok) {
      throw new Error(`Failed to get swap: ${response.statusText}`);
    }

    return response.json();
  }

  static async listActiveSwaps(): Promise<SwapResponse[]> {
    const response = await fetch(`${API_BASE_URL}/api/swaps?status=active`);

    if (!response.ok) {
      throw new Error(`Failed to list swaps: ${response.statusText}`);
    }

    return response.json();
  }

  static async cancelSwap(swapId: string): Promise<SwapResponse> {
    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel swap: ${response.statusText}`);
    }

    return response.json();
  }
}

// Token addresses for different chains
export const TOKEN_ADDRESSES = {
  base: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH identifier for 1inch
    WETH: '0x4200000000000000000000000000000000000006', // Wrapped ETH on Base
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base mainnet
  },
  ethereum: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH identifier for 1inch
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Wrapped ETH
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  stellar: {
    XLM: '0x0000000000000000000000000000000000000000', // Use zero address for native
    USDC: 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    // Add more Stellar assets as needed
  },
};

// Helper to get token address for a given chain and token symbol
export function getTokenAddress(chain: string, token: string): string {
  const chainTokens = TOKEN_ADDRESSES[chain as keyof typeof TOKEN_ADDRESSES];
  if (!chainTokens) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  
  const address = chainTokens[token as keyof typeof chainTokens];
  if (!address) {
    throw new Error(`Unknown token ${token} on chain ${chain}`);
  }
  
  return address;
}