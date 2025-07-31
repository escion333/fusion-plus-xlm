'use client';

import React from 'react';
import { useWallets } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    metamask, 
    freighter, 
    connectWallets, 
    disconnectWallets, 
    isFullyConnected 
  } = useWallets();

  const formatAddress = (address: string | null) => {
    if (!address || typeof address !== 'string') return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold">Stellar Fusion+</h1>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center">
            {isFullyConnected ? (
              <div className="flex items-center space-x-2">
                {/* Desktop view */}
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground text-xs">ETH:</span>
                    <span className="font-mono text-xs">{formatAddress(metamask.address)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground text-xs">XLM:</span>
                    <span className="font-mono text-xs">{formatAddress(freighter.publicKey)}</span>
                  </div>
                </div>
                {/* Mobile view - just show connected status */}
                <div className="flex sm:hidden items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">Connected</span>
                </div>
                <Button
                  onClick={disconnectWallets}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={connectWallets}
                size="sm"
                className="flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Connect Wallets</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};