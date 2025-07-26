"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Chain {
  id: string;
  name: string;
  icon: string;
}

const CHAINS: Chain[] = [
  { id: "ethereum", name: "Ethereum", icon: "⟠" },
  { id: "stellar", name: "Stellar", icon: "✦" },
];

interface ChainSelectorProps {
  chain: string;
  onChainChange: (chain: string) => void;
}

export function ChainSelector({ chain, onChainChange }: ChainSelectorProps) {
  return (
    <Select value={chain} onValueChange={onChainChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {CHAINS.find(c => c.id === chain)?.icon}
            </span>
            <span>{CHAINS.find(c => c.id === chain)?.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CHAINS.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{c.icon}</span>
              <span>{c.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}