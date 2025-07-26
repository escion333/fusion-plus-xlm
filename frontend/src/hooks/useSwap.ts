import { useState, useCallback } from 'react';
import { ResolverAPI, getTokenAddress } from '@/services/api';
import { useWallets } from '@/contexts/WalletContext';

interface SwapState {
  isLoading: boolean;
  error: string | null;
  currentSwapId: string | null;
  swapStatus: string | null;
}

export const useSwap = () => {
  const { metamask, freighter } = useWallets();
  const [state, setState] = useState<SwapState>({
    isLoading: false,
    error: null,
    currentSwapId: null,
    swapStatus: null,
  });

  const createSwap = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    if (!metamask.isConnected || !freighter.isConnected) {
      throw new Error('Both wallets must be connected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check resolver health first
      const isHealthy = await ResolverAPI.checkHealth();
      if (!isHealthy) {
        throw new Error('Resolver service is not available');
      }

      // Get the correct addresses based on chain
      const maker = fromChain === 'ethereum' ? metamask.address! : freighter.publicKey!;
      const taker = toChain === 'ethereum' ? metamask.address! : freighter.publicKey!;

      // Convert token symbols to addresses
      const sourceToken = getTokenAddress(fromChain, fromToken);
      const destToken = getTokenAddress(toChain, toToken);

      // Create the swap
      const swap = await ResolverAPI.createSwap({
        sourceChain: fromChain,
        destChain: toChain,
        sourceToken,
        destToken,
        amount,
        maker,
        taker,
      });

      setState(prev => ({
        ...prev,
        currentSwapId: swap.id,
        swapStatus: swap.status,
        isLoading: false,
      }));

      return swap;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      throw error;
    }
  }, [metamask, freighter]);

  const checkSwapStatus = useCallback(async (swapId: string) => {
    try {
      const swap = await ResolverAPI.getSwap(swapId);
      setState(prev => ({
        ...prev,
        swapStatus: swap.status,
      }));
      return swap;
    } catch (error) {
      console.error('Error checking swap status:', error);
      throw error;
    }
  }, []);

  const cancelSwap = useCallback(async (swapId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const swap = await ResolverAPI.cancelSwap(swapId);
      setState(prev => ({
        ...prev,
        swapStatus: swap.status,
        isLoading: false,
      }));
      return swap;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  return {
    ...state,
    createSwap,
    checkSwapStatus,
    cancelSwap,
  };
};