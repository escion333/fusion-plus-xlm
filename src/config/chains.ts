export interface ChainConfig {
  id: number | string;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockTime: number; // in seconds
  confirmations: number;
  escrowFactory?: string;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 12,
    confirmations: 12,
    escrowFactory: process.env.ETHEREUM_ESCROW_FACTORY || '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a',
  },
  sepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 12,
    confirmations: 3,
    escrowFactory: process.env.SEPOLIA_ESCROW_FACTORY,
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blockTime: 2,
    confirmations: 3,
    escrowFactory: process.env.BASE_ESCROW_FACTORY || '0xEe269949275B9b9C2c65e15922CC1F12ED82666E',
  },
  stellar: {
    id: 'stellar',
    name: 'Stellar',
    rpcUrl: process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    nativeCurrency: {
      name: 'Lumen',
      symbol: 'XLM',
      decimals: 7,
    },
    blockTime: 5,
    confirmations: 1,
    escrowFactory: process.env.STELLAR_CONTRACT_ID || 'CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL',
  },
  stellarTestnet: {
    id: 'stellar-testnet',
    name: 'Stellar Testnet',
    rpcUrl: process.env.STELLAR_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org',
    nativeCurrency: {
      name: 'Test Lumen',
      symbol: 'XLM',
      decimals: 7,
    },
    blockTime: 5,
    confirmations: 1,
    escrowFactory: process.env.STELLAR_TESTNET_ESCROW_CONTRACT,
  },
};

export type SupportedChain = keyof typeof CHAIN_CONFIGS;