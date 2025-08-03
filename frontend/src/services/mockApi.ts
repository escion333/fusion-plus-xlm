import { ethers } from 'ethers';

// Mock data generator
class MockDataGenerator {
  private orderCounter = 0;
  private mockOrders: Map<string, any> = new Map();

  generateOrderHash(): string {
    return `0x${Buffer.from(`mock-order-${Date.now()}-${this.orderCounter++}`).toString('hex')}`;
  }

  generateTxHash(): string {
    return `0x${Buffer.from(`mock-tx-${Date.now()}-${Math.random()}`).toString('hex').padEnd(64, '0').slice(0, 64)}`;
  }

  generateStellarContractId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = 'C'; // Stellar contract IDs start with C
    for (let i = 0; i < 55; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  generateEthAddress(): string {
    return ethers.Wallet.createRandom().address;
  }

  generateSecret(): string {
    return ethers.hexlify(ethers.randomBytes(32)).slice(2);
  }
}

const mockData = new MockDataGenerator();

// Mock API responses
export const mockFusionAPI = {
  getQuote: async (request: any) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Calculate mock amounts with realistic conversion
    const fromAmount = BigInt(request.amount);
    let toAmount: bigint;

    // Simple conversion logic for demo
    if (request.fromToken.includes('USDC') && request.toToken.includes('USDC')) {
      // USDC to USDC - 1:1 minus small fee
      toAmount = (fromAmount * BigInt(995)) / BigInt(1000); // 0.5% fee
    } else if (request.fromToken.includes('ETH') && request.toToken.includes('USDC')) {
      // ETH to USDC - assume 1 ETH = 2000 USDC for demo
      const ethPrice = BigInt(2000);
      toAmount = (fromAmount * ethPrice * BigInt(10) ** BigInt(6)) / BigInt(10) ** BigInt(18); // Convert decimals
    } else if (request.fromToken.includes('USDC') && request.toToken.includes('ETH')) {
      // USDC to ETH
      const ethPrice = BigInt(2000);
      toAmount = (fromAmount * BigInt(10) ** BigInt(18)) / (ethPrice * BigInt(10) ** BigInt(6));
    } else {
      // Default conversion
      toAmount = (fromAmount * BigInt(995)) / BigInt(1000);
    }

    return {
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amount,
      toAmount: toAmount.toString(),
      estimatedGas: '150000',
      protocols: [['MOCK_FUSION']],
      crossChain: request.fromChain !== request.toChain,
      isMockData: true
    };
  },

  createOrder: async (order: any) => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const orderHash = mockData.generateOrderHash();
    const mockOrder = {
      orderHash,
      maker: order.maker,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: order.makingAmount,
      takingAmount: order.takingAmount,
      deadline: order.deadline,
      status: 'pending',
      crossChain: order.crossChain,
      resolver: mockData.generateEthAddress(),
      secret: mockData.generateSecret(),
      escrowAddresses: {
        source: '',
        destination: ''
      },
      txHashes: {}
    };

    // Store order for status updates
    mockData.mockOrders.set(orderHash, mockOrder);

    // Simulate order processing
    setTimeout(() => {
      const storedOrder = mockData.mockOrders.get(orderHash);
      if (storedOrder) {
        storedOrder.status = 'processing';
        storedOrder.escrowAddresses = {
          source: mockData.generateEthAddress(),
          destination: mockData.generateStellarContractId()
        };
        storedOrder.txHashes = {
          sourceDeployment: mockData.generateTxHash(),
          destinationDeployment: mockData.generateTxHash()
        };
      }
    }, 3000);

    // Simulate withdrawal phase
    setTimeout(() => {
      const storedOrder = mockData.mockOrders.get(orderHash);
      if (storedOrder && storedOrder.status === 'processing') {
        storedOrder.txHashes.destinationWithdrawal = mockData.generateTxHash();
      }
    }, 8000);

    // Simulate completion
    setTimeout(() => {
      const storedOrder = mockData.mockOrders.get(orderHash);
      if (storedOrder && storedOrder.status === 'processing') {
        storedOrder.status = 'completed';
        storedOrder.txHashes.sourceWithdrawal = mockData.generateTxHash();
      }
    }, 12000);

    return mockOrder;
  },

  getOrderStatus: async (orderHash: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));

    const order = mockData.mockOrders.get(orderHash);
    if (!order) {
      throw new Error('Order not found');
    }

    return { order };
  },

  getActiveOrders: async (maker?: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));

    const orders = Array.from(mockData.mockOrders.values())
      .filter(order => !maker || order.maker === maker)
      .filter(order => order.status !== 'completed' && order.status !== 'failed');

    return { orders };
  }
};

// Health check mock
export const mockHealthCheck = async () => {
  return {
    overall: true,
    resolver: { status: 'healthy', url: 'http://localhost:3003' },
    proxy: { status: 'healthy', url: 'http://localhost:3002' }
  };
};