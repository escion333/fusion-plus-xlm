"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StellarLogo } from "@/components/icons/ChainLogos";
import Image from "next/image";

interface Chain {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const CHAINS: Chain[] = [
  { id: "base", name: "Base", icon: <Image src="/base-light.svg" alt="Base" width={20} height={20} /> },
  { id: "stellar", name: "Stellar", icon: <StellarLogo className="w-5 h-5" /> },
];

interface ChainSelectorProps {
  chain: string;
  onChainChange: (chain: string) => void;
}

export function ChainSelector({ chain, onChainChange }: ChainSelectorProps) {
  return (
    <Select value={chain} onValueChange={onChainChange}>
      <SelectTrigger className="w-[110px] px-2 py-1.5 h-9">
        <SelectValue>
          <div className="flex items-center space-x-2">
            {CHAINS.find(c => c.id === chain)?.icon}
            <span className="text-sm">{CHAINS.find(c => c.id === chain)?.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CHAINS.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <div className="flex items-center space-x-2">
              {c.icon}
              <span>{c.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}