import { useEffect } from 'react';

export const useWalletDetection = () => {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const detectWallets = () => {
      console.log('=== Wallet Detection ===');
      
      // Check basic window.ethereum
      if (window.ethereum) {
        console.log('window.ethereum exists:', {
          isMetaMask: window.ethereum.isMetaMask,
          isRabby: window.ethereum.isRabby,
          isBraveWallet: (window.ethereum as Window['ethereum'] & { isBraveWallet?: boolean })?.isBraveWallet,
          isExodus: (window.ethereum as Window['ethereum'] & { isExodus?: boolean })?.isExodus,
          _metamask: !!(window.ethereum as Window['ethereum'] & { _metamask?: unknown })?._metamask,
        });

        // Check for providers array (multiple wallets)
        const ethWithProviders = window.ethereum as Window['ethereum'] & { providers?: unknown[] };
        if (ethWithProviders.providers) {
          console.log('Multiple providers detected:', ethWithProviders.providers.length);
          ethWithProviders.providers.forEach((provider: unknown, index: number) => {
            const p = provider as { isMetaMask?: boolean; isRabby?: boolean; _metamask?: unknown; selectedAddress?: string; chainId?: string };
            console.log(`Provider ${index}:`, {
              isMetaMask: p.isMetaMask,
              isRabby: p.isRabby,
              _metamask: !!p._metamask,
              selectedAddress: p.selectedAddress,
              chainId: p.chainId,
            });
          });
        }
      } else {
        console.log('window.ethereum not found');
      }

      // Check for other wallet objects
      const wallets = {
        metamask: (window as Window & { metamask?: unknown }).metamask,
        rabby: (window as Window & { rabby?: unknown }).rabby,
        ethereum: window.ethereum,
      };

      console.log('Other wallet objects:', wallets);
      console.log('=== End Wallet Detection ===');
    };

    // Run detection
    detectWallets();

    // Also run after a delay in case wallets inject late
    const timeout = setTimeout(detectWallets, 1000);

    return () => clearTimeout(timeout);
  }, []);
};