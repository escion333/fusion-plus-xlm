"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, Activity } from "lucide-react";
import { ethers } from "ethers";
import { TokenSelector } from "./TokenSelector";
import { AmountInput } from "./AmountInput";
import { ChainSelector } from "./ChainSelector";
import { useState, useEffect } from "react";
import { useWallets } from "@/contexts/WalletContext";
import { useSwap } from "@/hooks/useSwap";
import { ResolverAPI, FusionAPI } from "@/services/api";

export function SwapCard() {
  const [fromChain, setFromChain] = useState("ethereum");
  const [toChain, setToChain] = useState("stellar");
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [use1inch, setUse1inch] = useState(true);
  const [showActiveOrders, setShowActiveOrders] = useState(false);

  const { isFullyConnected, connectWallets } = useWallets();
  const { createSwap, createFusionOrder, getQuote, isLoading, error, currentSwapId, swapStatus, quote, activeOrders, fetchActiveOrders } = useSwap();

  const handleSwap = async () => {
    if (!isFullyConnected) {
      await connectWallets();
      return;
    }

    try {
      if (use1inch) {
        // Create 1inch Fusion order
        const order = await createFusionOrder(
          fromChain,
          toChain,
          fromToken,
          toToken,
          fromAmount
        );
        console.log("Fusion order created:", order);
      } else {
        // Use direct resolver
        const swap = await createSwap(
          fromChain,
          toChain,
          fromToken,
          toToken,
          fromAmount
        );
        console.log("Swap created:", swap);
      }
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  // Check API status on mount
  useEffect(() => {
    ResolverAPI.checkHealth().then(isHealthy => {
      setApiStatus(isHealthy ? 'online' : 'offline');
    });
    
    // Fetch active orders if using 1inch
    if (use1inch) {
      fetchActiveOrders();
    }
  }, [use1inch, fetchActiveOrders]);
  
  // Get quote when amount changes
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      const debounceTimer = setTimeout(() => {
        getQuote(fromChain, toChain, fromToken, toToken, fromAmount)
          .then(quote => {
            setToAmount(ethers.formatUnits(quote.toAmount, toToken === 'XLM' ? 7 : 6));
          })
          .catch(console.error);
      }, 500);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [fromAmount, fromChain, toChain, fromToken, toToken, getQuote]);

  const switchChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-bold">
            {use1inch ? "1inch Fusion+" : "Cross-Chain Swap"}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUse1inch(!use1inch)}
          >
            {use1inch ? "Use Direct" : "Use 1inch"}
          </Button>
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
          {use1inch && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protocol</span>
              <span className="text-blue-600">1inch Fusion+</span>
            </div>
          )}
          {apiStatus !== 'checking' && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resolver Status</span>
              <span className={apiStatus === 'online' ? 'text-green-600' : 'text-red-600'}>
                {apiStatus === 'online' ? '● Online' : '● Offline'}
              </span>
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
        {use1inch && activeOrders.length > 0 && (
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
          disabled={(!fromAmount || parseFloat(fromAmount) <= 0) || isLoading}
        >
          {isLoading ? "Processing..." : isFullyConnected ? use1inch ? "Create 1inch Order" : "Swap" : "Connect Wallets"}
        </Button>
      </CardContent>
    </Card>
  );
}