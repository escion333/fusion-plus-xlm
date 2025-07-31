import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { FusionAPI, getTokenAddress } from '@/services/api';
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
    isMockData?: boolean;
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

  // Removed createSwap - only using 1inch Fusion+


  // Get quote from 1inch
  const getQuote = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: string,
    mockMode: boolean = false
  ) => {
    try {
      const sourceToken = getTokenAddress(fromChain, fromToken);
      const destToken = getTokenAddress(toChain, toToken);
      
      // Convert amount to proper decimals
      const amountInWei = fromToken === 'ETH' 
        ? ethers.parseEther(amount).toString()
        : fromToken === 'XLM'
        ? ethers.parseUnits(amount, 7).toString()
        : ethers.parseUnits(amount, 6).toString(); // USDC
      
      const quote = await FusionAPI.getQuote({
        fromToken: sourceToken,
        toToken: destToken,
        amount: amountInWei,
        fromChain,
        toChain,
      }, mockMode);
      
      setState(prev => ({
        ...prev,
        quote: {
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          estimatedGas: quote.estimatedGas,
          isMockData: quote.isMockData,
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
    amount: string,
    mockMode: boolean = false
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
      const quote = await getQuote(fromChain, toChain, fromToken, toToken, amount, mockMode);
      
      // Convert amount to proper decimals
      const makingAmountInWei = fromToken === 'ETH' 
        ? ethers.parseEther(amount).toString()
        : fromToken === 'XLM'
        ? ethers.parseUnits(amount, 7).toString()
        : ethers.parseUnits(amount, 6).toString(); // USDC
      
      // Create Fusion order
      const order = await FusionAPI.createOrder({
        maker,
        makerAsset: sourceToken,
        takerAsset: destToken,
        makingAmount: makingAmountInWei,
        takingAmount: quote.toAmount,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        crossChain: toChain !== fromChain ? {
          enabled: true,
          destinationChain: toChain,
          stellarReceiver: toChain === 'stellar' ? (freighter.publicKey || undefined) : undefined,
        } : undefined,
      }, mockMode);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
      
      
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
  }, [metamask, freighter, getQuote]);

  // Fetch active orders
  const fetchActiveOrders = useCallback(async (mockMode: boolean = false) => {
    try {
      const orders = await FusionAPI.getActiveOrders(metamask.address || undefined, mockMode);
      setState(prev => ({ ...prev, activeOrders: orders }));
      return orders;
    } catch (error) {
      console.error('Error fetching active orders:', error);
      return [];
    }
  }, [metamask.address]);

  return {
    ...state,
    getQuote,
    createFusionOrder,
    fetchActiveOrders,
  };
};