'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useMetaMask } from '@/hooks/useMetaMask';
import { useFreighter } from '@/hooks/useFreighter';

interface WalletContextType {
  metamask: ReturnType<typeof useMetaMask>;
  freighter: ReturnType<typeof useFreighter>;
  connectWallets: () => Promise<void>;
  disconnectWallets: () => void;
  isFullyConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const metamask = useMetaMask();
  const freighter = useFreighter();

  const connectWallets = async () => {
    try {
      // Connect directly to Rabby (or whatever wallet is available)
      const walletConnection = await metamask.connect('auto');
      
      // After connection, ensure we're on Base mainnet
      if (walletConnection && walletConnection.provider) {
        const network = await walletConnection.provider.getNetwork();
        const chainId = Number(network.chainId);
        console.log('Connected to chain:', chainId);
        
        if (chainId !== 8453) {
          console.log('Switching to Base mainnet...');
          await metamask.switchToBase();
        }
      }
      
      // Connect Freighter for Stellar
      await freighter.connect();
    } catch (error) {
      console.error('Error connecting wallets:', error);
      throw error;
    }
  };

  const disconnectWallets = () => {
    metamask.disconnect();
    freighter.disconnect();
  };

  const isFullyConnected = metamask.isConnected && freighter.isConnected;

  return (
    <WalletContext.Provider value={{
      metamask,
      freighter,
      connectWallets,
      disconnectWallets,
      isFullyConnected,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallets = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallets must be used within a WalletProvider');
  }
  return context;
};