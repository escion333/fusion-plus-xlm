import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Fusion+ | Institutional DeFi Infrastructure",
  description: "Institutional-grade cross-chain liquidity protocol powered by 1inch Fusion+",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} font-sans antialiased`}
      >
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
