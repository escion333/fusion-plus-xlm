import Image from "next/image";
import { EthereumLogo, StellarLogo } from "./ChainLogos";

export const USDCLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={className}>
    <Image 
      src="/usdc-logo.svg" 
      alt="USDC" 
      width={24} 
      height={24} 
      className="w-full h-full"
    />
  </div>
);

export const USDTLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <circle cx="128" cy="128" r="128" fill="#50AF95"/>
    <path fill="white" d="M178.9 118.5v-18h-35.7V62.1h-30.6v38.4H76.9v18h35.7v76.3h30.6v-76.3h35.7zm-49.7 44.8c-23.5 0-42.5-5.4-42.5-12.1s19-12.1 42.5-12.1 42.5 5.4 42.5 12.1-19 12.1-42.5 12.1zm0-9.2c-18.1 0-32.8-3.4-32.8-7.6s14.7-7.6 32.8-7.6 32.8 3.4 32.8 7.6-14.7 7.6-32.8 7.6z"/>
  </svg>
);

// For ETH, we'll use the Ethereum logo
export { EthereumLogo as ETHLogo };

// For XLM, we'll use the Stellar logo
export { StellarLogo as XLMLogo };