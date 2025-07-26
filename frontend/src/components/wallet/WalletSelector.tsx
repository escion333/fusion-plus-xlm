'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const EVM_WALLETS: WalletOption[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect with MetaMask',
  },
  {
    id: 'rabby',
    name: 'Rabby',
    icon: '🐰',
    description: 'Connect with Rabby Wallet',
  },
];

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => Promise<void>;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({
  isOpen,
  onClose,
  onSelectWallet,
}) => {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWalletSelect = async (walletId: string) => {
    setSelectedWallet(walletId);
    setIsConnecting(true);
    setError(null);

    try {
      await onSelectWallet(walletId);
      onClose();
    } catch (err: any) {
      // Handle specific error cases
      if (err?.code === 'ACTION_REJECTED' || err?.message?.includes('user rejected') || err?.message?.includes('User rejected')) {
        setError('Connection cancelled by user');
      } else if (err?.message?.includes('already pending')) {
        setError('A connection request is already pending. Please check your wallet.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
      setSelectedWallet(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select EVM Wallet</DialogTitle>
          <DialogDescription>
            Choose your preferred wallet to connect to Ethereum/EVM chains
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {EVM_WALLETS.map((wallet) => (
            <Card
              key={wallet.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedWallet === wallet.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => !isConnecting && handleWalletSelect(wallet.id)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium">{wallet.name}</h4>
                  <p className="text-sm text-gray-500">{wallet.description}</p>
                </div>
                {selectedWallet === wallet.id && isConnecting && (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                )}
              </div>
            </Card>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
            {error.includes('No Ethereum wallet detected') && (
              <p className="text-xs text-red-500 mt-1">
                Make sure MetaMask is installed and enabled in your browser.
              </p>
            )}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};