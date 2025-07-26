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
      let ethereum: any;


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

      const provider = new ethers.BrowserProvider(ethereum);
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
      ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setState(prev => ({ ...prev, address: accounts[0] }));
        }
      });

      // Listen for chain changes
      ethereum.on('chainChanged', (chainId: string) => {
        window.location.reload();
      });

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

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
      });
    } catch (error: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error.code === 4902) {
        await window.ethereum.request({
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

  return {
    ...state,
    connect,
    disconnect,
    switchToSepolia,
  };
};

// Extend window interface for TypeScript
declare global {
  interface Window {
    ethereum: any & {
      isMetaMask?: boolean;
      isRabby?: boolean;
    };
    rabby?: any;
  }
}