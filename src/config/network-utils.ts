/**
 * Network configuration utilities
 * Provides centralized network configuration management
 */

export type Network = 'mainnet' | 'testnet';
export type Chain = 'ethereum' | 'base' | 'stellar';

interface NetworkConfig {
  stellar: {
    factory: string;
    rpc: string;
    passphrase: string;
    explorerUrl: string;
  };
  base: {
    factory: string;
    resolver: string;
    rpc: string;
    explorerUrl: string;
    chainId: number;
  };
}

const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  mainnet: {
    stellar: {
      factory: process.env.STELLAR_FACTORY_MAINNET || 'CDBO2XF6X6EJPI25DYZRDY3TEE2O4WTVZQN5YK5BVGU2I66X3LWEQQJL',
      rpc: process.env.STELLAR_RPC || 'https://soroban-rpc.mainnet.stellar.gateway.fm',
      passphrase: 'Public Global Stellar Network ; September 2015',
      explorerUrl: 'https://stellar.expert/explorer/public',
    },
    base: {
      factory: process.env.BASE_HTLC_FACTORY || '0x18D410f651289BB978Fc32F90D2d7E608F4f4560',
      resolver: process.env.RESOLVER_ADDRESS || '0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1',
      rpc: process.env.BASE_RPC || 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      chainId: 8453,
    },
  },
  testnet: {
    stellar: {
      factory: process.env.STELLAR_FACTORY_TESTNET || 'CCQZ5LB3WA7XBJQYORYUUWAJDWCM7UXIEHHDNJWFSN6E337IZ4Q43MQG',
      rpc: process.env.STELLAR_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org',
      passphrase: 'Test SDF Network ; September 2015',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
    },
    base: {
      factory: process.env.BASE_SEPOLIA_FACTORY || '0xA7803E684C1532463B9db19EA685Bc3eEDF7f71B',
      resolver: process.env.BASE_SEPOLIA_RESOLVER || '0xe7e9E1B7D4BE66D596D8f599c892ffdfFD8dD866',
      rpc: 'https://sepolia.base.org',
      explorerUrl: 'https://sepolia.basescan.org',
      chainId: 84532,
    },
  },
};

/**
 * Get the current network from environment
 */
export function getCurrentNetwork(): Network {
  const network = process.env.STELLAR_NETWORK || process.env.NETWORK || 'mainnet';
  return network === 'testnet' ? 'testnet' : 'mainnet';
}

/**
 * Get Stellar factory address for the current network
 */
export function getStellarFactory(network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork].stellar.factory;
}

/**
 * Get Base factory address for the current network
 */
export function getBaseFactory(network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork].base.factory;
}

/**
 * Get resolver address for the current network
 */
export function getResolverAddress(network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork].base.resolver;
}

/**
 * Get RPC URL for a specific chain
 */
export function getRpcUrl(chain: Chain, network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  
  switch (chain) {
    case 'stellar':
      return NETWORK_CONFIGS[currentNetwork].stellar.rpc;
    case 'base':
    case 'ethereum':
      return NETWORK_CONFIGS[currentNetwork].base.rpc;
    default:
      throw new Error(`Unknown chain: ${chain}`);
  }
}

/**
 * Get explorer URL for a specific chain
 */
export function getExplorerUrl(chain: Chain, network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  
  switch (chain) {
    case 'stellar':
      return NETWORK_CONFIGS[currentNetwork].stellar.explorerUrl;
    case 'base':
    case 'ethereum':
      return NETWORK_CONFIGS[currentNetwork].base.explorerUrl;
    default:
      throw new Error(`Unknown chain: ${chain}`);
  }
}

/**
 * Get Stellar network passphrase
 */
export function getStellarPassphrase(network?: Network): string {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork].stellar.passphrase;
}

/**
 * Get chain ID for Base network
 */
export function getBaseChainId(network?: Network): number {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork].base.chainId;
}

/**
 * Get complete network configuration
 */
export function getNetworkConfig(network?: Network): NetworkConfig {
  const currentNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[currentNetwork];
}

/**
 * Build explorer link for a transaction or address
 */
export function buildExplorerLink(
  chain: Chain,
  type: 'tx' | 'address' | 'contract',
  hash: string,
  network?: Network
): string {
  const explorerUrl = getExplorerUrl(chain, network);
  
  if (chain === 'stellar') {
    switch (type) {
      case 'tx':
        return `${explorerUrl}/tx/${hash}`;
      case 'address':
        return `${explorerUrl}/account/${hash}`;
      case 'contract':
        return `${explorerUrl}/contract/${hash}`;
    }
  } else {
    switch (type) {
      case 'tx':
        return `${explorerUrl}/tx/${hash}`;
      case 'address':
      case 'contract':
        return `${explorerUrl}/address/${hash}`;
    }
  }
}

/**
 * Check if running on mainnet
 */
export function isMainnet(): boolean {
  return getCurrentNetwork() === 'mainnet';
}

/**
 * Check if running on testnet
 */
export function isTestnet(): boolean {
  return getCurrentNetwork() === 'testnet';
}

export default {
  getCurrentNetwork,
  getStellarFactory,
  getBaseFactory,
  getResolverAddress,
  getRpcUrl,
  getExplorerUrl,
  getStellarPassphrase,
  getBaseChainId,
  getNetworkConfig,
  buildExplorerLink,
  isMainnet,
  isTestnet,
};