'use client';

import React, { createContext, useContext, ReactNode, useState } from 'react';
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
      await metamask.connect('auto');
      
      // Connect Freighter for Stellar
      await freighter.connect();
      
      // Ensure wallet is on mainnet (chain ID 1)
      if (metamask.chainId && metamask.chainId !== 1) {
        await metamask.switchToMainnet();
      }
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