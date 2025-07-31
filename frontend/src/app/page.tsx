import { SwapCard } from "@/components/swap/SwapCard";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col items-center space-y-8 max-w-lg mx-auto">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-lg">
              Trustless cross-chain swaps between Ethereum and Stellar
            </p>
          </div>
          
          <SwapCard />
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Powered by 1inch Fusion+ Protocol</p>
          </div>
        </div>
      </main>
    </div>
  );
}