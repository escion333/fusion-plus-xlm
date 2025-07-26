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
          isBraveWallet: (window.ethereum as any).isBraveWallet,
          isExodus: (window.ethereum as any).isExodus,
          _metamask: !!(window.ethereum as any)._metamask,
        });

        // Check for providers array (multiple wallets)
        if ((window.ethereum as any).providers) {
          console.log('Multiple providers detected:', (window.ethereum as any).providers.length);
          (window.ethereum as any).providers.forEach((provider: any, index: number) => {
            console.log(`Provider ${index}:`, {
              isMetaMask: provider.isMetaMask,
              isRabby: provider.isRabby,
              _metamask: !!provider._metamask,
              selectedAddress: provider.selectedAddress,
              chainId: provider.chainId,
            });
          });
        }
      } else {
        console.log('window.ethereum not found');
      }

      // Check for other wallet objects
      const wallets = {
        metamask: (window as any).metamask,
        rabby: (window as any).rabby,
        ethereum: (window as any).ethereum,
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