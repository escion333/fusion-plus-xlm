"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";
import { ethers } from "ethers";
import { TokenSelector } from "./TokenSelector";
import { AmountInput } from "./AmountInput";
import { useState, useEffect } from "react";
import { StellarLogo } from "@/components/icons/ChainLogos";
import Image from "next/image";
import { useWallets } from "@/contexts/WalletContext";
import { useSwap } from "@/hooks/useSwap";
import { useBalances } from "@/hooks/useBalances";
import { useDebounce } from "@/hooks/useDebounce";
import { FusionAPI } from "@/services/api";
import { SwapProgress } from "./SwapProgress";
import { ErrorDisplay } from "./ErrorDisplay";

export function SwapCard() {
  const [fromChain, setFromChain] = useState("base");
  const [toChain, setToChain] = useState("stellar");
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [swapState, setSwapState] = useState<'idle' | 'creating' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [orderHash, setOrderHash] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const isMockMode = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

  const { isFullyConnected } = useWallets();
  const { createFusionOrder, getQuote, isLoading, error, currentSwapId, swapStatus, quote } = useSwap();
  const { 
    base: baseBalance, 
    stellar: xlmBalance, 
    baseUSDC: baseUSDCBalance,
    stellarUSDC: xlmUSDCBalance,
    loading: balancesLoading, 
    refreshBalances 
  } = useBalances();
  
  // Debounce amount input for quote fetching
  const debouncedFromAmount = useDebounce(fromAmount, 500);

  const handleSwap = async () => {
    if (!isFullyConnected) {
      return;
    }

    try {
      setSwapState('creating');
      const order = await createFusionOrder(
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount
      );
      
      if (order && order.orderHash) {
        setOrderHash(order.orderHash);
        setSwapState('pending');
        
        // Poll for order status updates
        const pollInterval = setInterval(async () => {
          try {
            const result = await FusionAPI.getOrderStatus(order.orderHash);
            
            // Handle different response formats - result might be { order: ... } or just the order data
            const orderData: any = result.order || result;
            
            // Safety check - make sure we have order data
            if (!orderData || typeof orderData !== 'object') {
              console.warn('Invalid order data received:', result);
              return;
            }
            
            // Update swap state based on order status
            if (orderData.status === 'pending') {
              setSwapState('pending');
            } else if (orderData.status === 'processing' || orderData.status === 'escrow_created') {
              setSwapState('processing');
            } else if (orderData.status === 'completed') {
              setSwapState('completed');
              clearInterval(pollInterval);
              refreshBalances();
              // Set order details including secret
              setOrderDetails({
                resolver: orderData.resolver,
                secret: orderData.secret,
                escrowAddresses: orderData.escrowAddresses,
                txHashes: orderData.txHashes
              });
              // Don't auto-reset - wait for user to close
            } else if (orderData.status === 'failed' || orderData.status === 'cancelled') {
              setSwapState('failed');
              clearInterval(pollInterval);
              // Don't auto-reset - wait for user to close
            }
            
            // Update order details for progress tracking
            if (orderData.escrowAddresses || orderData.txHashes) {
              setOrderDetails({
                resolver: orderData.resolver,
                secret: orderData.secret,
                escrowAddresses: orderData.escrowAddresses,
                txHashes: orderData.txHashes
              });
            }
          } catch (error) {
            console.error('Failed to poll order status:', error);
          }
        }, 1000); // Poll every second
        
        // Clear interval after 30 seconds as safety measure
        setTimeout(() => clearInterval(pollInterval), 30000);
      }
    } catch (error) {
      console.error("Swap failed:", error);
      setSwapState('failed');
      // Don't auto-reset - wait for user to close
    }
  };

  
  // Get quote when amount changes (using debounced value)
  useEffect(() => {
    if (debouncedFromAmount && parseFloat(debouncedFromAmount) > 0 && isFullyConnected) {
      getQuote(fromChain, toChain, fromToken, toToken, debouncedFromAmount)
        .then(quote => {
          // USDC has 6 decimals on both chains, XLM has 7, ETH has 18
          const decimals = toToken === 'XLM' ? 7 : toToken === 'ETH' ? 18 : 6;
          setToAmount(ethers.formatUnits(quote.toAmount, decimals));
        })
        .catch(error => {
          console.error('Failed to get quote:', error);
          setToAmount('');
          if (!isMockMode) {
            // In live mode, show the actual error
            console.error('Live mode quote error:', error.message);
          }
        });
    }
  }, [debouncedFromAmount, fromChain, toChain, fromToken, toToken, getQuote, isFullyConnected, isMockMode]);



  const switchChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };
  
  const handleCloseProgress = () => {
    setSwapState('idle');
    setOrderHash(null);
    setOrderDetails(null);
    setFromAmount('');
    setToAmount('');
  };

  return (
    <div className="w-full flex gap-6 justify-center items-start">
      {/* Show progress when swap is active */}
      {swapState !== 'idle' && (
        <div className="w-full max-w-md">
          <SwapProgress 
            status={swapState}
            orderHash={orderHash || undefined}
            estimatedTime={120}
            error={error || undefined}
            orderDetails={orderDetails}
            onClose={handleCloseProgress}
            isMockMode={isMockMode}
          />
        </div>
      )}
      
      {/* Main swap card */}
      <Card className={`bg-neutral-900/80 backdrop-blur-sm border-0 w-full max-w-md transition-opacity ${
        swapState !== 'idle' ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-medium text-neutral-0">
            Swap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Swap Container */}
        <div className="space-y-4">
          {/* From Section */}
          <div className="bg-neutral-800/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <span className="text-xs text-neutral-300 uppercase tracking-wide">From</span>
                <AmountInput
                  value={fromAmount}
                  onChange={setFromAmount}
                  placeholder="0"
                />
                {isFullyConnected && (
                  <div className="text-xs text-neutral-400">
                    Balance: {balancesLoading ? 'Loading...' : (
                      fromChain === 'base' 
                        ? (fromToken === 'ETH' ? `${parseFloat(baseBalance).toFixed(4)} ETH` : `${parseFloat(baseUSDCBalance).toFixed(2)} USDC`)
                        : (fromToken === 'XLM' ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : `${parseFloat(xlmUSDCBalance).toFixed(2)} USDC`)
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-lg">
                  {fromChain === 'base' ? (
                    <Image src="/base-light.svg" alt="Base" width={20} height={20} />
                  ) : (
                    <StellarLogo className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium text-neutral-200">
                    {fromChain === 'base' ? 'Base' : 'Stellar'}
                  </span>
                </div>
                <TokenSelector
                  token={fromToken}
                  onTokenChange={setFromToken}
                  chain={fromChain}
                />
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-neutral-800 hover:bg-neutral-700 border-2 border-neutral-700 w-10 h-10"
              onClick={switchChains}
            >
              <ArrowDownIcon className="h-5 w-5 text-neutral-400" />
            </Button>
          </div>

          {/* To Section */}
          <div className="bg-neutral-800/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <span className="text-xs text-neutral-300 uppercase tracking-wide">To</span>
                <AmountInput
                  value={toAmount}
                  onChange={setToAmount}
                  placeholder="0"
                  disabled
                />
                {isFullyConnected && (
                  <div className="text-xs text-neutral-400">
                    Balance: {balancesLoading ? 'Loading...' : (
                      toChain === 'base' 
                        ? (toToken === 'ETH' ? `${parseFloat(baseBalance).toFixed(4)} ETH` : `${parseFloat(baseUSDCBalance).toFixed(2)} USDC`)
                        : (toToken === 'XLM' ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : `${parseFloat(xlmUSDCBalance).toFixed(2)} USDC`)
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-lg">
                  {toChain === 'base' ? (
                    <Image src="/base-light.svg" alt="Base" width={20} height={20} />
                  ) : (
                    <StellarLogo className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium text-neutral-200">
                    {toChain === 'base' ? 'Base' : 'Stellar'}
                  </span>
                </div>
                <TokenSelector
                  token={toToken}
                  onTokenChange={setToToken}
                  chain={toChain}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        {quote && fromAmount && parseFloat(fromAmount) > 0 && (
          <div className="bg-neutral-800/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Rate</span>
              <span className="text-neutral-200">
                1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Network Fee</span>
              <span className="text-neutral-200">{quote?.estimatedGas ? `~${ethers.formatUnits(quote.estimatedGas, 'gwei')} Gwei` : '--'}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <ErrorDisplay 
            error={error} 
            onRetry={() => {
              // Retry fetching quote if amount is set
              if (fromAmount && parseFloat(fromAmount) > 0) {
                getQuote(fromChain, toChain, fromToken, toToken, fromAmount)
                  .catch(err => console.error('Retry failed:', err));
              }
            }}
            isMockMode={isMockMode}
          />
        )}

        {/* Swap Status */}
        {currentSwapId && swapStatus && (
          <div className="text-sm p-3 border border-brand-primary/20 rounded-xl bg-brand-primary/10">
            <div className="font-medium text-neutral-0">Swap ID: {currentSwapId.slice(0, 8)}...</div>
            <div className="text-neutral-100">Status: {swapStatus}</div>
          </div>
        )}


        {/* Swap Button */}
        <button 
          onClick={handleSwap}
          className="w-full py-3 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={(!fromAmount || parseFloat(fromAmount) <= 0) || isLoading || !isFullyConnected}
        >
          {isLoading ? "Processing..." : !isFullyConnected ? "Connect Wallets" : "Swap"}
        </button>

      </CardContent>
    </Card>
    </div>
  );
}