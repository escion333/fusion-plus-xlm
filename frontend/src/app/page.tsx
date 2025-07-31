import { SwapCard } from "@/components/swap/SwapCard";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-gradient">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-0">
              Stellar to Ethereum <span className="text-brand-primary">with 1inch</span>
            </h1>
          </div>
        </div>
        
        {/* Background gradient orbs */}
        <div className="absolute top-20 left-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-secondary/20 rounded-full blur-3xl -z-10" />
      </section>

      {/* Swap Interface */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <SwapCard />
        </div>
      </section>
    </div>
  );
}