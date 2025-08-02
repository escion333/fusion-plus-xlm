'use client';

import React from 'react';
import { useWallets } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { StellarLogo } from '@/components/icons/ChainLogos';
import Image from 'next/image';

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-900/80 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo/Title */}
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-medium text-neutral-0">
              Fusion+ <span className="text-neutral-400">Extension</span>
            </h1>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center">
            {isFullyConnected ? (
              <div className="flex items-center space-x-2">
                {/* Desktop view */}
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/50">
                    <Image src="/base-light.svg" alt="Base" width={16} height={16} />
                    <span className="font-mono text-xs text-neutral-300">{formatAddress(metamask.address)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/50">
                    <StellarLogo className="w-4 h-4" />
                    <span className="font-mono text-xs text-neutral-300">{formatAddress(freighter.publicKey)}</span>
                  </div>
                </div>
                {/* Mobile view - just show connected status */}
                <div className="flex sm:hidden items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-700/50 border border-neutral-500/20">
                  <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></div>
                  <span className="text-xs text-neutral-0">Connected</span>
                </div>
                <Button
                  onClick={disconnectWallets}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-neutral-100 hover:text-neutral-0 hover:bg-neutral-700/50"
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={connectWallets}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium text-neutral-0 transition-colors flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};