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
      <Card className={`w-full max-w-md mx-auto transition-opacity ${
        swapState !== 'idle' ? 'opacity-50 pointer-events-none' : ''
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              1inch Fusion+
            </CardTitle>
            <div className="flex items-center gap-2">
              <TestTube className={`h-4 w-4 ${isMockMode ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              <span className="text-sm text-muted-foreground">
                {isMockMode ? 'Mock' : 'Live'}
              </span>
              <Switch
                checked={!isMockMode}
                onCheckedChange={(checked) => setIsMockMode(!checked)}
                aria-label="Toggle between mock and live mode"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* From Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">From</span>
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
            <div className="text-xs text-muted-foreground">
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
            className="rounded-full"
            onClick={switchChains}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">To</span>
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
            <div className="text-xs text-muted-foreground">
              Balance: {balancesLoading ? 'Loading...' : (
                toChain === 'ethereum' 
                  ? (toToken === 'ETH' ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(ethUSDCBalance).toFixed(2)} USDC`)
                  : (toToken === 'XLM' ? `${parseFloat(xlmBalance).toFixed(2)} XLM` : `${parseFloat(xlmUSDCBalance).toFixed(2)} USDC`)
              )}
            </div>
          )}
        </div>

        {/* Swap Details */}
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span>
              {quote && fromAmount && parseFloat(fromAmount) > 0
                ? `1 ${fromToken} = ${(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} ${toToken}`
                : `1 ${fromToken} = -- ${toToken}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Time</span>
            <span>~5 minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network Fee</span>
            <span>{quote?.estimatedGas ? `~${ethers.formatUnits(quote.estimatedGas, 'gwei')} Gwei` : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protocol</span>
            <span className="text-blue-600">1inch Fusion+</span>
          </div>
          {(quote?.isMockData || isMockMode) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Source</span>
              <span className="text-yellow-600 text-xs">Mock Data (Demo Mode)</span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-600 text-sm p-2 border border-red-200 rounded bg-red-50">
            {error}
          </div>
        )}

        {/* Swap Status */}
        {currentSwapId && swapStatus && (
          <div className="text-sm p-2 border rounded bg-blue-50">
            <div className="font-medium">Swap ID: {currentSwapId.slice(0, 8)}...</div>
            <div className="text-muted-foreground">Status: {swapStatus}</div>
          </div>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Orders</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActiveOrders(!showActiveOrders)}
              >
                <Activity className="h-4 w-4 mr-1" />
                {activeOrders.length}
              </Button>
            </div>
            {showActiveOrders && (
              <div className="space-y-2">
                {activeOrders.slice(0, 3).map((order: any) => (
                  <div key={order.orderHash} className="text-xs p-2 border rounded">
                    <div className="flex justify-between">
                      <span>Order ID:</span>
                      <span className="font-mono">{order.orderHash.slice(0, 10)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="text-green-600">{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Swap Button */}
        <Button 
          onClick={handleSwap}
          className="w-full"
          size="lg"
          disabled={(!fromAmount || parseFloat(fromAmount) <= 0) || isLoading || !isFullyConnected}
        >
          {isLoading ? "Processing..." : !isFullyConnected ? "Connect Wallets First" : "Create 1inch Order"}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}