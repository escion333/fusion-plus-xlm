import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@/contexts/WalletContext';
import { useDebounce } from './useDebounce';
import { ERC20_ABI } from '@/lib/abi/erc20';
import { TOKEN_ADDRESSES } from '@/services/api';

interface Balances {
  base: string;
  stellar: string;
  baseUSDC: string;
  stellarUSDC: string;
  loading: boolean;
  error: string | null;
}

export function useBalances() {
  const { metamask, freighter } = useWallets();
  const [balances, setBalances] = useState<Balances>({
    base: '0',
    stellar: '0',
    baseUSDC: '0',
    stellarUSDC: '0',
    loading: false,
    error: null
  });

  // Debounce wallet connections to avoid rapid re-fetching
  const debouncedMetamaskConnected = useDebounce(metamask.isConnected, 500);
  const debouncedFreighterConnected = useDebounce(freighter.isConnected, 500);

  const fetchBaseBalance = useCallback(async () => {
    if (!metamask.isConnected || !metamask.provider || !metamask.address) {
      return '0';
    }

    try {
      const balance = await metamask.provider.getBalance(metamask.address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      throw error;
    }
  }, [metamask.isConnected, metamask.provider, metamask.address]);

  const fetchBaseUSDCBalance = useCallback(async () => {
    if (!metamask.isConnected || !metamask.provider || !metamask.address) {
      return '0';
    }

    try {
      // Check network
      const network = await metamask.provider.getNetwork();
      const chainId = Number(network.chainId);
      console.log('Current network chainId:', chainId, 'Expected Base:', 8453);
      
      // If not on Base, return 0
      if (chainId !== 8453) {
        console.warn('Not on Base network. Please switch to Base mainnet (chainId: 8453)');
        return '0';
      }
      
      const usdcContract = new ethers.Contract(
        TOKEN_ADDRESSES.base.USDC,
        ERC20_ABI,
        metamask.provider
      );
      console.log('Fetching USDC balance for:', metamask.address, 'Contract:', TOKEN_ADDRESSES.base.USDC);
      
      // First check if contract exists
      const code = await metamask.provider.getCode(TOKEN_ADDRESSES.base.USDC);
      if (code === '0x') {
        console.error('USDC contract not found at address:', TOKEN_ADDRESSES.base.USDC);
        return '0';
      }
      
      const balance = await usdcContract.balanceOf(metamask.address);
      const formattedBalance = ethers.formatUnits(balance, 6); // USDC has 6 decimals
      console.log('USDC balance:', formattedBalance);
      return formattedBalance;
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      return '0';
    }
  }, [metamask.isConnected, metamask.provider, metamask.address]);

  const fetchStellarBalance = useCallback(async () => {
    if (!freighter.isConnected || !freighter.publicKey) {
      return { xlm: '0', usdc: '0' };
    }

    try {
      const response = await fetch(
        `https://horizon.stellar.org/accounts/${freighter.publicKey}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch Stellar balance');
      }

      const data = await response.json();
      interface StellarBalance {
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }
      
      const xlmBalance = data.balances?.find((b: StellarBalance) => b.asset_type === 'native')?.balance || '0';
      
      // Find USDC balance
      const usdcBalance = data.balances?.find((b: StellarBalance) => 
        b.asset_type === 'credit_alphanum4' && 
        b.asset_code === 'USDC' &&
        b.asset_issuer === 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
      )?.balance || '0';
      
      return { xlm: xlmBalance, usdc: usdcBalance };
    } catch (error) {
      console.error('Error fetching Stellar balances:', error);
      return { xlm: '0', usdc: '0' };
    }
  }, [freighter.isConnected, freighter.publicKey]);

  const fetchBalances = useCallback(async () => {
    setBalances(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [baseBalance, baseUSDCBalance, stellarBalances] = await Promise.all([
        debouncedMetamaskConnected ? fetchBaseBalance() : Promise.resolve('0'),
        debouncedMetamaskConnected ? fetchBaseUSDCBalance() : Promise.resolve('0'),
        debouncedFreighterConnected ? fetchStellarBalance() : Promise.resolve({ xlm: '0', usdc: '0' })
      ]);

      setBalances({
        base: baseBalance,
        baseUSDC: baseUSDCBalance,
        stellar: stellarBalances.xlm,
        stellarUSDC: stellarBalances.usdc,
        loading: false,
        error: null
      });
    } catch (error) {
      setBalances(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch balances'
      }));
    }
  }, [debouncedMetamaskConnected, debouncedFreighterConnected, fetchBaseBalance, fetchBaseUSDCBalance, fetchStellarBalance]);

  // Refresh balances when wallet connections change (debounced)
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Provide a manual refresh function
  const refreshBalances = useCallback(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    ...balances,
    refreshBalances
  };
}