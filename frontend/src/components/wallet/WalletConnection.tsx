'use client';

import React, { useState } from 'react';
import { useWallets } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WalletSelector } from './WalletSelector';
import { useWalletDetection } from '@/hooks/useWalletDetection';

export const WalletConnection: React.FC = () => {
  // Detect available wallets
  useWalletDetection();
  
  const { 
    metamask, 
    freighter, 
    connectWallets, 
    disconnectWallets, 
    isFullyConnected
  } = useWallets();
  
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Connect Freighter after EVM wallet is connected
  React.useEffect(() => {
    const connectFreighterIfNeeded = async () => {
      if (metamask.isConnected && !freighter.isConnected && !showWalletSelector) {
        try {
          console.log('EVM wallet connected, now connecting Freighter...');
          await freighter.connect();
        } catch (error) {
          console.error('Error connecting Freighter:', error);
          // Show error to user
          alert('Failed to connect Freighter wallet. Please make sure Freighter is installed.');
        }
      }
    };

    connectFreighterIfNeeded();
  }, [metamask.isConnected, freighter.isConnected, freighter, showWalletSelector]);

  const formatAddress = (address: string | null) => {
    if (!address || typeof address !== 'string') return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isFullyConnected) {
    console.log('Wallet states:', {
      metamask: { address: metamask.address, isConnected: metamask.isConnected },
      freighter: { publicKey: freighter.publicKey, isConnected: freighter.isConnected }
    });
    
    return (
      <Card className="mb-4 glass-card">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-100">Ethereum:</span>
              <span className="text-sm font-mono">
                {metamask.address && formatAddress(metamask.address)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-100">Stellar:</span>
              <span className="text-sm font-mono">
                {freighter.publicKey && formatAddress(freighter.publicKey)}
              </span>
            </div>
            <Button 
              onClick={disconnectWallets}
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              Disconnect Wallets
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-4 glass-card">
        <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-neutral-0">Connect Your Wallets</h3>
            <p className="text-sm text-neutral-100 mb-4">
              You need to connect both EVM and Stellar wallets to perform cross-chain swaps
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-xl border border-neutral-500/20 bg-neutral-700/50">
              <span className="text-sm">
                EVM Wallet {metamask.isConnected ? '✓' : ''}
              </span>
              <span className="text-xs text-neutral-100">
                {metamask.isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-2 rounded-xl border border-neutral-500/20 bg-neutral-700/50">
              <span className="text-sm">
                Freighter {freighter.isConnected ? '✓' : ''}
              </span>
              <span className="text-xs text-neutral-100">
                {freighter.isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>

          <Button 
            onClick={connectWallets}
            className="w-full"
            disabled={isFullyConnected}
          >
            Connect Both Wallets
          </Button>

          {metamask.isConnected && !freighter.isConnected && (
            <>
              <Button
                onClick={async () => {
                  try {
                    await freighter.connect();
                  } catch (error) {
                    console.error('Error connecting Freighter:', error);
                    alert('Failed to connect Freighter.\n\nPlease ensure:\n1. Freighter is installed\n2. Freighter is unlocked (enter your password)\n3. You have at least one account in Freighter\n4. Approve the connection when prompted');
                  }
                }}
                variant="outline"
                className="w-full mt-2"
              >
                Connect Freighter Manually
              </Button>
              <p className="text-xs text-neutral-100 text-center mt-2">
                Make sure Freighter is unlocked before connecting
              </p>
            </>
          )}

          {!isFullyConnected && (metamask.isConnected || freighter.isConnected) && (
            <p className="text-xs text-center text-yellow-500">
              Please connect both wallets to continue
            </p>
          )}
        </div>
      </CardContent>
    </Card>

    <WalletSelector
      isOpen={showWalletSelector}
      onClose={() => setShowWalletSelector(false)}
      onSelectWallet={async (walletId: string) => {
        try {
          await metamask.connect(walletId as any);
          setShowWalletSelector(false);
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      }}
    />
    </>
  );
};