"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, Activity, TestTube } from "lucide-react";
import { ethers } from "ethers";
import { TokenSelector } from "./TokenSelector";
import { AmountInput } from "./AmountInput";
import { ChainSelector } from "./ChainSelector";
import { useState, useEffect } from "react";
import { useWallets } from "@/contexts/WalletContext";
import { useSwap } from "@/hooks/useSwap";
import { useBalances } from "@/hooks/useBalances";
import { useDebounce } from "@/hooks/useDebounce";
import { FusionAPI } from "@/services/api";
import { SwapProgress } from "./SwapProgress";
import { Switch } from "@/components/ui/switch";

export function SwapCard() {
  const [fromChain, setFromChain] = useState("ethereum");
  const [toChain, setToChain] = useState("stellar");
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [swapState, setSwapState] = useState<'idle' | 'creating' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [orderHash, setOrderHash] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isMockMode, setIsMockMode] = useState(true);

  const { isFullyConnected, connectWallets } = useWallets();
  const { createFusionOrder, getQuote, isLoading, error, currentSwapId, swapStatus, quote, activeOrders, fetchActiveOrders } = useSwap();
  const { 
    ethereum: ethBalance, 
    stellar: xlmBalance, 
    ethereumUSDC: ethUSDCBalance,
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
        fromAmount,
        isMockMode
      );
      
      if (order && order.orderHash) {
        setOrderHash(order.orderHash);
        setSwapState('pending');
        
        // Poll for order status updates
        const pollInterval = setInterval(async () => {
          try {
            const status = await FusionAPI.getOrderStatus(order.orderHash, isMockMode);
            
            // Update order details
            setOrderDetails({
              resolver: status.resolver,
              escrowAddresses: status.escrowAddresses,
              txHashes: status.txHashes,
            });
            
            // Update swap state based on order progress
            if (status.progress === 'pending') {
              setSwapState('pending');
            } else if (status.progress === 'processing') {
              setSwapState('processing');
            } else if (status.progress === 'completed') {
              setSwapState('completed');
              clearInterval(pollInterval);
              refreshBalances();
              // Don't auto-reset - wait for user to close
            } else if (status.progress === 'failed') {
              setSwapState('failed');
              clearInterval(pollInterval);
              // Don't auto-reset - wait for user to close
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

  // Fetch active orders on mount and when mock mode changes
  useEffect(() => {
    fetchActiveOrders(isMockMode);
  }, [fetchActiveOrders, isMockMode]);
  
  // Get quote when amount changes (using debounced value)
  useEffect(() => {
    if (debouncedFromAmount && parseFloat(debouncedFromAmount) > 0 && isFullyConnected) {
      getQuote(fromChain, toChain, fromToken, toToken, debouncedFromAmount, isMockMode)
        .then(quote => {
          // USDC has 6 decimals on both chains, XLM has 7, ETH has 18
          const decimals = toToken === 'XLM' ? 7 : toToken === 'ETH' ? 18 : 6;
          setToAmount(ethers.formatUnits(quote.toAmount, decimals));
        })
        .catch(console.error);
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
    <>
      {/* Show progress when swap is active */}
      {swapState !== 'idle' && (
        <div className="mb-4">
          <SwapProgress 
            status={swapState}
            orderHash={orderHash || undefined}
            estimatedTime={120}
            error={error || undefined}
            orderDetails={orderDetails}
            onClose={handleCloseProgress}
          />
        </div>
      )}
      
      {/* Main swap card */}
      <Card className={`glass-card w-full max-w-md mx-auto transition-opacity ${
        swapState !== 'idle' ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <CardHeader className="border-b border-neutral-700/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-transparent bg-clip-text bg-brand-gradient">
              1inch Fusion+
            </CardTitle>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-700/50 border border-neutral-500/20">
              <TestTube className={`h-4 w-4 ${isMockMode ? 'text-yellow-500' : 'text-neutral-100'}`} />
              <span className="text-sm text-neutral-100">
                {isMockMode ? 'Mock' : 'Live'}
              </span>
              <Switch
                checked={!isMockMode}
                onCheckedChange={(checked) => setIsMockMode(!checked)}
                aria-label="Toggle between mock and live mode"
                className="data-[state=checked]:bg-brand-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* From Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-100">From</span>
            <ChainSelector 
              chain={fromChain} 
              onChainChange={setFromChain}
            />
          </div>
          <div className="flex space-x-2">
            <AmountInput
              value={fromAmount}
              onChange={setFromAmount}
              placeholder="0.0"
            />
            <TokenSelector
              token={fromToken}
              onTokenChange={setFromToken}
              chain={fromChain}
            />
          </div>
          {isFullyConnected && (
            <div className="text-xs text-neutral-100">
              Balance: {balancesLoading ? 'Loading...' : (
                fromChain === 'ethereum' 
                  ? (fromToken === 'ETH' ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(ethUSDCBalance).toFixed(2)} USDC`)
                  : (fromToken === 'XLM' ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : `${parseFloat(xlmUSDCBalance).toFixed(2)} USDC`)
              )}
            </div>
          )}
        </div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-neutral-700/50 border-neutral-500/20 hover:bg-neutral-700 hover:border-brand-primary/50"
            onClick={switchChains}
          >
            <ArrowDownIcon className="h-4 w-4 text-neutral-100" />
          </Button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-100">To</span>
            <ChainSelector 
              chain={toChain} 
              onChainChange={setToChain}
            />
          </div>
          <div className="flex space-x-2">
            <AmountInput
              value={toAmount}
              onChange={setToAmount}
              placeholder="0.0"
              disabled
            />
            <TokenSelector
              token={toToken}
              onTokenChange={setToToken}
              chain={toChain}
            />
          </div>
          {isFullyConnected && (
            <div className="text-xs text-neutral-100">
              Balance: {balancesLoading ? 'Loading...' : (
                toChain === 'ethereum' 
                  ? (toToken === 'ETH' ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(ethUSDCBalance).toFixed(2)} USDC`)
                  : (toToken === 'XLM' ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : `${parseFloat(xlmUSDCBalance).toFixed(2)} USDC`)
              )}
            </div>
          )}
        </div>

        {/* Swap Details */}
        <div className="border-t border-neutral-700/50 pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-100">Rate</span>
            <span>
              {quote && fromAmount && parseFloat(fromAmount) > 0
                ? `1 ${fromToken} = ${(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} ${toToken}`
                : `1 ${fromToken} = -- ${toToken}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-100">Estimated Time</span>
            <span>~5 minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-100">Network Fee</span>
            <span>{quote?.estimatedGas ? `~${ethers.formatUnits(quote.estimatedGas, 'gwei')} Gwei` : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-100">Protocol</span>
            <span className="text-brand-primary">1inch Fusion+</span>
          </div>
          {(quote?.isMockData || isMockMode) && (
            <div className="flex justify-between">
              <span className="text-neutral-100">Data Source</span>
              <span className="text-yellow-500 text-xs">Mock Data (Demo Mode)</span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-400 text-sm p-3 border border-red-500/20 rounded-xl bg-red-500/10">
            {error}
          </div>
        )}

        {/* Swap Status */}
        {currentSwapId && swapStatus && (
          <div className="text-sm p-3 border border-brand-primary/20 rounded-xl bg-brand-primary/10">
            <div className="font-medium text-neutral-0">Swap ID: {currentSwapId.slice(0, 8)}...</div>
            <div className="text-neutral-100">Status: {swapStatus}</div>
          </div>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <div className="border-t border-neutral-700/50 pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-neutral-0">Active Orders</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActiveOrders(!showActiveOrders)}
                className="text-neutral-100 hover:text-neutral-0 hover:bg-neutral-700/50"
              >
                <Activity className="h-4 w-4 mr-1" />
                {activeOrders.length}
              </Button>
            </div>
            {showActiveOrders && (
              <div className="space-y-2">
                {activeOrders.slice(0, 3).map((order: any) => (
                  <div key={order.orderHash} className="text-xs p-3 border border-neutral-700/50 rounded-xl bg-neutral-700/30">
                    <div className="flex justify-between">
                      <span className="text-neutral-100">Order ID:</span>
                      <span className="font-mono text-neutral-0">{order.orderHash.slice(0, 10)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-100">Status:</span>
                      <span className="text-brand-secondary">{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Swap Button */}
        <button 
          onClick={handleSwap}
          className="btn-gradient w-full py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={(!fromAmount || parseFloat(fromAmount) <= 0) || isLoading || !isFullyConnected}
        >
          {isLoading ? "Processing..." : !isFullyConnected ? "Connect Wallets First" : "Create 1inch Order"}
        </button>
      </CardContent>
    </Card>
    </>
  );
}