import { SwapCard } from "@/components/swap/SwapCard";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-gradient relative overflow-hidden">
      {/* Abstract animated background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 rounded-full blur-3xl animate-morph" />
        </div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-secondary/20 to-brand-primary/20 rounded-full blur-3xl animate-morph-reverse animation-delay-1000" />
        </div>
      </div>

      <div className="relative z-10">
        <Header />
        
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="container mx-auto px-4 pt-20 pb-4">
            <div className="max-w-5xl mx-auto text-center">
              <h1 className="text-2xl md:text-3xl font-medium text-neutral-200">
                Cross-chain swaps powered by <span className="text-brand-primary">1inch Fusion+</span>
              </h1>
            </div>
          </div>
        </section>

        {/* Swap Interface */}
        <section className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <SwapCard />
          </div>
        </section>
      </div>
    </div>
  );
}