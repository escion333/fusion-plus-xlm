import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
// import * as StellarSdk from 'stellar-sdk';
import { FusionAPI, getTokenAddress } from '@/services/api';
import { useWallets } from '@/contexts/WalletContext';
import { checkServicesHealth } from '@/utils/healthCheck';

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
  activeOrders: Array<{
    orderHash: string;
    srcAmount: string;
    dstAmount: string;
    srcChain: string;
    dstChain: string;
    status: string;
    createdAt?: string;
  }>;
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
    amount: string
  ) => {
    // Check service health first
    const health = await checkServicesHealth();
    if (!health.overall) {
      const unhealthyServices = [];
      if (health.resolver.status === 'unhealthy') {
        unhealthyServices.push(`Resolver Service (${health.resolver.url})`);
      }
      if (health.proxy.status === 'unhealthy') {
        unhealthyServices.push(`API Proxy (${health.proxy.url})`);
      }
      throw new Error(`Required services are not running: ${unhealthyServices.join(', ')}. Please start all services.`);
    }
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
    
    // Check service health first
    const health = await checkServicesHealth();
    if (!health.overall) {
      const unhealthyServices = [];
      if (health.resolver.status === 'unhealthy') {
        unhealthyServices.push(`Resolver Service (${health.resolver.url})`);
      }
      if (health.proxy.status === 'unhealthy') {
        unhealthyServices.push(`API Proxy (${health.proxy.url})`);
      }
      throw new Error(`Required services are not running: ${unhealthyServices.join(', ')}. Please start all services.`);
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const maker = metamask.address!;
      const sourceToken = getTokenAddress(fromChain, fromToken);
      const destToken = getTokenAddress(toChain, toToken);
      
      // Get quote first
      const quote = await getQuote(fromChain, toChain, fromToken, toToken, amount);
      
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
      });
      
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
  const fetchActiveOrders = useCallback(async () => {
    try {
      const orders = await FusionAPI.getActiveOrders(metamask.address || undefined);
      setState(prev => ({ 
        ...prev, 
        activeOrders: orders.map(order => ({
          orderHash: order.orderHash,
          srcAmount: order.makingAmount,
          dstAmount: order.takingAmount,
          srcChain: 'base', // Default since FusionOrder doesn't have chain info
          dstChain: order.crossChain?.destinationChain || 'base',
          status: order.status,
          createdAt: undefined
        }))
      }));
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