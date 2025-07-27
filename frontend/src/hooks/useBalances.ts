import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@/contexts/WalletContext';
import { useDebounce } from './useDebounce';

interface Balances {
  ethereum: string;
  stellar: string;
  loading: boolean;
  error: string | null;
}

export function useBalances() {
  const { metamask, freighter } = useWallets();
  const [balances, setBalances] = useState<Balances>({
    ethereum: '0',
    stellar: '0',
    loading: false,
    error: null
  });

  // Debounce wallet connections to avoid rapid re-fetching
  const debouncedMetamaskConnected = useDebounce(metamask.isConnected, 500);
  const debouncedFreighterConnected = useDebounce(freighter.isConnected, 500);

  const fetchEthereumBalance = useCallback(async () => {
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

  const fetchStellarBalance = useCallback(async () => {
    if (!freighter.isConnected || !freighter.publicKey) {
      return '0';
    }

    try {
      const response = await fetch(
        `https://horizon.stellar.org/accounts/${freighter.publicKey}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch Stellar balance');
      }

      const data = await response.json();
      const xlmBalance = data.balances?.find((b: any) => b.asset_type === 'native')?.balance || '0';
      return xlmBalance;
    } catch (error) {
      console.error('Error fetching XLM balance:', error);
      throw error;
    }
  }, [freighter.isConnected, freighter.publicKey]);

  const fetchBalances = useCallback(async () => {
    setBalances(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [ethBalance, xlmBalance] = await Promise.all([
        debouncedMetamaskConnected ? fetchEthereumBalance() : Promise.resolve('0'),
        debouncedFreighterConnected ? fetchStellarBalance() : Promise.resolve('0')
      ]);

      setBalances({
        ethereum: ethBalance,
        stellar: xlmBalance,
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
  }, [debouncedMetamaskConnected, debouncedFreighterConnected, fetchEthereumBalance, fetchStellarBalance]);

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