import { useState, useCallback } from 'react';
import freighterApi from '@stellar/freighter-api';

interface FreighterState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
}

export const useFreighter = () => {
  const [state, setState] = useState<FreighterState>({
    isConnected: false,
    publicKey: null,
    network: null,
  });

  const checkConnection = useCallback(async () => {
    try {
      const connected = await freighterApi.isConnected();
      if (connected) {
        // Get the address/public key (don't use requestAccess here to avoid prompts)
        const result = await freighterApi.getAddress();
        const publicKey = result.error ? '' : result.address;
        
        const { network } = await freighterApi.getNetworkDetails();
        setState({
          isConnected: true,
          publicKey,
          network,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking Freighter connection:', error);
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      console.log('Attempting to connect to Freighter...');
      const isInstalled = await freighterApi.isConnected();
      console.log('Freighter installed:', isInstalled);
      
      if (!isInstalled) {
        throw new Error('Freighter wallet is not installed. Please install the Freighter browser extension.');
      }

      // Check if we already have access
      const hasAccess = await freighterApi.isAllowed();
      console.log('Freighter access already granted:', hasAccess);

      // Request access - this will prompt for permission if needed
      console.log('Requesting Freighter access...');
      
      // Use requestAccess to get permission and the address
      const accessResult = await freighterApi.requestAccess();
      console.log('Access result:', accessResult);
      
      let address = '';
      if (accessResult.error) {
        console.error('Freighter access error:', accessResult.error);
        throw new Error(accessResult.error);
      } else {
        address = accessResult.address;
      }
      
      console.log('Final extracted address:', address);
      
      const networkResult = await freighterApi.getNetworkDetails();
      console.log('Full network result:', networkResult);
      const network = typeof networkResult === 'string' ? networkResult : networkResult.network;
      console.log('Freighter network:', network);

      // Accept both mainnet and testnet
      console.log('Network check passed - using:', network);

      if (!address) {
        console.error('Failed to extract address. The wallet may need to be unlocked or you need to approve the connection.');
        throw new Error('Failed to get Freighter address. Please make sure Freighter is unlocked and try again.');
      }

      setState({
        isConnected: true,
        publicKey: address,
        network,
      });

      return { publicKey: address, network };
    } catch (error) {
      console.error('Error connecting to Freighter:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      publicKey: null,
      network: null,
    });
  }, []);

  const signXDR = useCallback(async (xdr: string, options?: { network?: string }) => {
    if (!state.isConnected) {
      throw new Error('Freighter is not connected');
    }

    try {
      // Use the connected network or allow override
      const networkPassphrase = options?.network || state.network || 'PUBLIC';
      const signedTransaction = await freighterApi.signTransaction(xdr, {
        networkPassphrase,
      });
      return signedTransaction;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }, [state.isConnected, state.network]);

  return {
    ...state,
    connect,
    disconnect,
    checkConnection,
    signXDR,
  };
};