"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Token {
  symbol: string;
  name: string;
  icon: string;
}

const ETHEREUM_TOKENS: Token[] = [
  { symbol: "ETH", name: "Ethereum", icon: "Ξ" },
  { symbol: "USDC", name: "USD Coin", icon: "$" },
  { symbol: "USDT", name: "Tether", icon: "₮" },
];

const STELLAR_TOKENS: Token[] = [
  { symbol: "XLM", name: "Stellar Lumens", icon: "*" },
  { symbol: "USDC", name: "USD Coin", icon: "$" },
];

interface TokenSelectorProps {
  token: string;
  onTokenChange: (token: string) => void;
  chain: string;
}

export function TokenSelector({ token, onTokenChange, chain }: TokenSelectorProps) {
  const tokens = chain === "ethereum" ? ETHEREUM_TOKENS : STELLAR_TOKENS;

  return (
    <Select value={token} onValueChange={onTokenChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {tokens.find(t => t.symbol === token)?.icon}
            </span>
            <span>{token}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tokens.map((t) => (
          <SelectItem key={t.symbol} value={t.symbol}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{t.icon}</span>
              <div>
                <div className="font-medium">{t.symbol}</div>
                <div className="text-xs text-muted-foreground">{t.name}</div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}