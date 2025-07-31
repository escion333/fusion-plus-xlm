import Image from "next/image";

export const EthereumLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={className}>
    <Image 
      src="/ethereum-logo.svg" 
      alt="Ethereum" 
      width={24} 
      height={24} 
      className="w-full h-full"
    />
  </div>
);

export const StellarLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={className}>
    <Image 
      src="/stellar-logo.svg" 
      alt="Stellar" 
      width={24} 
      height={24} 
      className="w-full h-full brightness-0 invert"
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  </div>
);