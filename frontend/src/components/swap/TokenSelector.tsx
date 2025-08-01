"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETHLogo, XLMLogo, USDCLogo, USDTLogo } from "@/components/icons/TokenLogos";

interface Token {
  symbol: string;
  name: string;
  icon: React.ReactNode;
}

const ETHEREUM_TOKENS: Token[] = [
  { symbol: "ETH", name: "Ethereum", icon: <ETHLogo className="w-5 h-5" /> },
  { symbol: "USDC", name: "USD Coin", icon: <USDCLogo className="w-5 h-5" /> },
  { symbol: "USDT", name: "Tether", icon: <USDTLogo className="w-5 h-5" /> },
];

const STELLAR_TOKENS: Token[] = [
  { symbol: "XLM", name: "Stellar Lumens", icon: <XLMLogo className="w-5 h-5" /> },
  { symbol: "USDC", name: "USD Coin", icon: <USDCLogo className="w-5 h-5" /> },
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
      <SelectTrigger className="w-[110px] px-2 py-1.5 h-9">
        <SelectValue>
          <div className="flex items-center space-x-2">
            {tokens.find(t => t.symbol === token)?.icon}
            <span className="text-sm font-medium">{token}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tokens.map((t) => (
          <SelectItem key={t.symbol} value={t.symbol}>
            <div className="flex items-center space-x-2">
              {t.icon}
              <div>
                <div className="font-medium">{t.symbol}</div>
                <div className="text-xs text-neutral-100">{t.name}</div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}