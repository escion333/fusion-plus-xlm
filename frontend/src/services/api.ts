const API_BASE_URL = process.env.NEXT_PUBLIC_RESOLVER_API_URL || 'http://localhost:3001';

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
  ethereum: {
    ETH: '0x0000000000000000000000000000000000000000',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  stellar: {
    XLM: 'native',
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