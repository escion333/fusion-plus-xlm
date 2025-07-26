import { useState, useCallback } from 'react';
import { ResolverAPI, FusionAPI, getTokenAddress } from '@/services/api';
import { useWallets } from '@/contexts/WalletContext';

interface SwapState {
  isLoading: boolean;
  error: string | null;
  currentSwapId: string | null;
  swapStatus: string | null;
  quote: {
    fromAmount: string;
    toAmount: string;
    estimatedGas: string;
  } | null;
  activeOrders: any[];
}

export const useSwap = () => {
  const { metamask, freighter } = useWallets();
  const [state, setState] = useState<SwapState>({
    isLoading: false,
    error: null,
    currentSwapId: null,
    swapStatus: null,
    quote: null,
    activeOrders: [],
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

  // Get quote from 1inch
  const getQuote = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    try {
      const sourceToken = getTokenAddress(fromChain, fromToken);
      const destToken = getTokenAddress(toChain, toToken);
      
      const quote = await FusionAPI.getQuote({
        fromToken: sourceToken,
        toToken: destToken,
        amount,
        fromChain,
        toChain,
      });
      
      setState(prev => ({
        ...prev,
        quote: {
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          estimatedGas: quote.estimatedGas,
        },
      }));
      
      return quote;
    } catch (error) {
      console.error('Error getting quote:', error);
      throw error;
    }
  }, []);

  // Create 1inch Fusion order
  const createFusionOrder = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    if (!metamask.isConnected) {
      throw new Error('MetaMask must be connected');
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const maker = metamask.address!;
      const sourceToken = getTokenAddress(fromChain, fromToken);
      const destToken = getTokenAddress(toChain, toToken);
      
      // Get quote first
      const quote = await getQuote(fromChain, toChain, fromToken, toToken, amount);
      
      // Create Fusion order
      const order = await FusionAPI.createOrder({
        maker,
        makerAsset: sourceToken,
        takerAsset: destToken,
        makingAmount: amount,
        takingAmount: quote.toAmount,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        crossChain: toChain !== fromChain ? {
          enabled: true,
          destinationChain: toChain,
          stellarReceiver: toChain === 'stellar' ? (freighter.publicKey || undefined) : undefined,
        } : undefined,
      });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
      
      // Also create swap in resolver
      await createSwap(fromChain, toChain, fromToken, toToken, amount);
      
      return order;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      throw error;
    }
  }, [metamask, freighter, createSwap, getQuote]);

  // Fetch active orders
  const fetchActiveOrders = useCallback(async () => {
    try {
      const orders = await FusionAPI.getActiveOrders(metamask.address || undefined);
      setState(prev => ({ ...prev, activeOrders: orders }));
      return orders;
    } catch (error) {
      console.error('Error fetching active orders:', error);
      return [];
    }
  }, [metamask.address]);

  return {
    ...state,
    createSwap,
    checkSwapStatus,
    cancelSwap,
    getQuote,
    createFusionOrder,
    fetchActiveOrders,
  };
};