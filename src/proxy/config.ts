export const PROXY_CONFIG = {
  port: process.env.PROXY_PORT || 3002,
  
  // 1inch API endpoints
  oneinch: {
    baseUrl: 'https://api.1inch.dev',
    endpoints: {
      quote: '/swap/v6.0/1/quote',
      swap: '/swap/v6.0/1/swap',
      tokens: '/swap/v6.0/1/tokens',
      approve: '/swap/v6.0/1/approve',
      allowance: '/swap/v6.0/1/approve/allowance',
    },
  },
  
  // 1inch Fusion endpoints
  fusion: {
    baseUrl: 'https://fusion.1inch.io',
    endpoints: {
      orders: {
        active: '/fusion/orders/v2.0/1/all',
        create: '/fusion/orders/v2.0/1/order',
        status: '/fusion/orders/v2.0/1/order/status',
        cancel: '/fusion/orders/v2.0/1/order/cancel',
      },
      quoter: '/fusion/quoter/v2.0/1/quote',
      relayers: '/fusion/relayers/v2.0/1/all',
    },
  },
  
  // Supported chains
  chains: {
    ethereum: {
      id: 1,
      name: 'Ethereum',
      rpc: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    },
    sepolia: {
      id: 11155111,
      name: 'Sepolia',
      rpc: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    },
  },
  
  // Common token addresses
  tokens: {
    ethereum: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    },
    sepolia: {
      WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
      USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    },
  },
};