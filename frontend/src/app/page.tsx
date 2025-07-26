import { SwapCard } from "@/components/swap/SwapCard";
import { WalletConnection } from "@/components/wallet/WalletConnection";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <main className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center space-y-8 max-w-lg mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Stellar Fusion+
            </h1>
            <p className="text-muted-foreground text-lg">
              Trustless cross-chain swaps between Ethereum and Stellar
            </p>
          </div>
          
          <WalletConnection />
          
          <SwapCard />
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by 1inch Fusion+ Protocol</p>
          </div>
        </div>
      </main>
    </div>
  );
}