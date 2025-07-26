"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";
import { TokenSelector } from "./TokenSelector";
import { AmountInput } from "./AmountInput";
import { ChainSelector } from "./ChainSelector";
import { useState, useEffect } from "react";
import { useWallets } from "@/contexts/WalletContext";
import { useSwap } from "@/hooks/useSwap";
import { ResolverAPI } from "@/services/api";

export function SwapCard() {
  const [fromChain, setFromChain] = useState("ethereum");
  const [toChain, setToChain] = useState("stellar");
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const { isFullyConnected, connectWallets } = useWallets();
  const { createSwap, isLoading, error, currentSwapId, swapStatus } = useSwap();

  const handleSwap = async () => {
    if (!isFullyConnected) {
      await connectWallets();
      return;
    }

    try {
      const swap = await createSwap(
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount
      );
      console.log("Swap created:", swap);
      // TODO: Show swap progress UI
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  // Check API status on mount
  useEffect(() => {
    ResolverAPI.checkHealth().then(isHealthy => {
      setApiStatus(isHealthy ? 'online' : 'offline');
    });
  }, []);

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
        <CardTitle className="text-2xl font-bold text-center">
          Cross-Chain Swap
        </CardTitle>
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
            <span>1 {fromToken} = -- {toToken}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Time</span>
            <span>~5 minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network Fee</span>
            <span>--</span>
          </div>
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

        {/* Swap Button */}
        <Button 
          onClick={handleSwap}
          className="w-full"
          size="lg"
          disabled={(!fromAmount || parseFloat(fromAmount) <= 0) || isLoading}
        >
          {isLoading ? "Processing..." : isFullyConnected ? "Swap" : "Connect Wallets"}
        </Button>
      </CardContent>
    </Card>
  );
}