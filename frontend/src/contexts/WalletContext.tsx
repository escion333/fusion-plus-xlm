'use client';

import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useMetaMask } from '@/hooks/useMetaMask';
import { useFreighter } from '@/hooks/useFreighter';

interface WalletContextType {
  metamask: ReturnType<typeof useMetaMask>;
  freighter: ReturnType<typeof useFreighter>;
  connectWallets: () => Promise<void>;
  connectEvmWallet: (walletId: string) => Promise<void>;
  disconnectWallets: () => void;
  isFullyConnected: boolean;
  showWalletSelector: boolean;
  setShowWalletSelector: (show: boolean) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const metamask = useMetaMask();
  const freighter = useFreighter();
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const connectEvmWallet = async (walletId: string) => {
    try {
      await metamask.connect(walletId);
      
      // Ensure wallet is on Sepolia
      if (metamask.chainId && metamask.chainId !== 11155111) {
        await metamask.switchToSepolia();
      }
    } catch (error) {
      console.error('Error connecting EVM wallet:', error);
      throw error;
    }
  };

  const connectWallets = async () => {
    try {
      // Show wallet selector for EVM
      setShowWalletSelector(true);
      // Don't connect Freighter here - wait for EVM wallet to be selected first
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
      connectEvmWallet,
      disconnectWallets,
      isFullyConnected,
      showWalletSelector,
      setShowWalletSelector,
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