import { useState, useCallback } from 'react';
import { ethers } from 'ethers';

interface MetaMaskState {
  isConnected: boolean;
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId: number | null;
}

interface WalletConfig {
  walletId?: string;
}

export const useMetaMask = (config?: WalletConfig) => {
  const [state, setState] = useState<MetaMaskState>({
    isConnected: false,
    address: null,
    provider: null,
    signer: null,
    chainId: null,
  });

  const connect = useCallback(async (walletId?: string) => {
    try {
      const selectedWallet = walletId || config?.walletId || 'auto';
      let ethereum: typeof window.ethereum;


      // Handle different wallet providers
      if (selectedWallet === 'metamask') {
        // When Rabby is installed, it often overrides window.ethereum
        // But we can still try to connect and let the user choose in their wallet
        
        // Just use window.ethereum - let the wallet handle which one to use
        if (window.ethereum) {
          ethereum = window.ethereum;
        } else {
          throw new Error('No Ethereum wallet detected. Please install MetaMask.');
        }
      } else if (selectedWallet === 'rabby') {
        // Just use window.ethereum - Rabby will handle it
        if (window.ethereum) {
          ethereum = window.ethereum;
        } else {
          throw new Error('No Ethereum wallet detected. Please install Rabby.');
        }
      } else {
        // Auto-detect available wallet
        ethereum = window.ethereum;
        if (!ethereum) {
          throw new Error('No Ethereum wallet detected');
        }
      }

      const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setState({
        isConnected: true,
        address: accounts[0],
        provider,
        signer,
        chainId: Number(network.chainId),
      });

      // Listen for account changes
      if (ethereum && ethereum.on) {
        ethereum.on('accountsChanged', (accounts: unknown) => {
          const accountList = accounts as string[];
        if (accountList.length === 0) {
          disconnect();
        } else {
          setState(prev => ({ ...prev, address: accountList[0] }));
        }
      });
      }

      // Listen for chain changes
      if (ethereum && ethereum.on) {
        ethereum.on('chainChanged', (chainId: unknown) => {
        setState(prev => ({ ...prev, chainId: parseInt(chainId as string, 16) }));
        });
      }

      return { provider, signer, address: accounts[0] };
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      throw error;
    }
  }, [config?.walletId]);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      provider: null,
      signer: null,
      chainId: null,
    });
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }
    
    const ethereum = window.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
      });
    } catch (error) {
      // This error code indicates that the chain has not been added to MetaMask
      if ((error as { code?: number }).code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia Testnet',
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.infura.io/v3/'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      } else {
        throw error;
      }
    }
  }, []);

  const switchToMainnet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('Wallet is not installed');
    }
    
    const ethereum = window.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }], // Mainnet chainId
      });
    } catch (error) {
      throw error;
    }
  }, []);

  const switchToBase = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('Wallet is not installed');
    }
    
    const ethereum = window.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base mainnet chainId (8453 in hex)
      });
    } catch (error) {
      // This error code indicates that the chain has not been added to MetaMask
      if ((error as { code?: number }).code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
      } else {
        throw error;
      }
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    switchToSepolia,
    switchToMainnet,
    switchToBase,
  };
};

// Extend window interface for TypeScript
declare global {
  interface Window {
    ethereum: {
      isMetaMask?: boolean;
      isRabby?: boolean;
      request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    rabby?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}