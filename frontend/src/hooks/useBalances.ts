import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@/contexts/WalletContext';
import { useDebounce } from './useDebounce';
import { ERC20_ABI } from '@/lib/abi/erc20';
import { TOKEN_ADDRESSES } from '@/services/api';

interface Balances {
  ethereum: string;
  stellar: string;
  ethereumUSDC: string;
  stellarUSDC: string;
  loading: boolean;
  error: string | null;
}

export function useBalances() {
  const { metamask, freighter } = useWallets();
  const [balances, setBalances] = useState<Balances>({
    ethereum: '0',
    stellar: '0',
    ethereumUSDC: '0',
    stellarUSDC: '0',
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

  const fetchEthereumUSDCBalance = useCallback(async () => {
    if (!metamask.isConnected || !metamask.provider || !metamask.address) {
      return '0';
    }

    try {
      const usdcContract = new ethers.Contract(
        TOKEN_ADDRESSES.ethereum.USDC,
        ERC20_ABI,
        metamask.provider
      );
      const balance = await usdcContract.balanceOf(metamask.address);
      return ethers.formatUnits(balance, 6); // USDC has 6 decimals
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
      const xlmBalance = data.balances?.find((b: any) => b.asset_type === 'native')?.balance || '0';
      
      // Find USDC balance
      const usdcBalance = data.balances?.find((b: any) => 
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
      const [ethBalance, ethUSDCBalance, stellarBalances] = await Promise.all([
        debouncedMetamaskConnected ? fetchEthereumBalance() : Promise.resolve('0'),
        debouncedMetamaskConnected ? fetchEthereumUSDCBalance() : Promise.resolve('0'),
        debouncedFreighterConnected ? fetchStellarBalance() : Promise.resolve({ xlm: '0', usdc: '0' })
      ]);

      setBalances({
        ethereum: ethBalance,
        ethereumUSDC: ethUSDCBalance,
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
  }, [debouncedMetamaskConnected, debouncedFreighterConnected, fetchEthereumBalance, fetchEthereumUSDCBalance, fetchStellarBalance]);

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