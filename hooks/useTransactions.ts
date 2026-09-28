"use client";

import { useCallback, useEffect, useState } from "react";

import { getTransactions as getMockTransactions } from "@/services/transaction.service";
import type { Transaction } from "@/types/transaction";
import { ARC_TESTNET_CHAIN_ID_HEX } from "@/lib/web3/config";
import { getEthereumProvider, type Eip1193Provider } from "@/lib/web3/provider";
import { getOnChainUsdcTransactions } from "@/lib/web3/onChainTransactions";

async function loadTransactions(): Promise<Transaction[]> {
  const provider = getEthereumProvider();

  if (provider) {
    try {
      const [accounts, chainId] = await Promise.all([
        provider.request({ method: "eth_accounts" }) as Promise<string[]>,
        provider.request({ method: "eth_chainId" }) as Promise<string>,
      ]);

      const address = accounts[0];
      if (address && chainId === ARC_TESTNET_CHAIN_ID_HEX) {
        return await getOnChainUsdcTransactions(provider, address);
      }
    } catch (error) {
      console.error("Failed to load Arc on-chain transactions:", error);
    }
  }

  const fallback = await getMockTransactions();
  return fallback.map((tx) => ({ ...tx, source: "mock" as const }));
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data = await loadTransactions();
      setTransactions(data);
      return data;
    } catch (error) {
      console.error("Failed to load transactions:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    let active = true;
    const provider: Eip1193Provider | null = getEthereumProvider();

    async function load() {
      setLoading(true);
      try {
        const data = await loadTransactions();
        if (active) setTransactions(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    function handleWalletChange() {
      void load();
    }

    void load();
    provider?.on?.("accountsChanged", handleWalletChange);
    provider?.on?.("chainChanged", handleWalletChange);

    return () => {
      active = false;
      provider?.removeListener?.("accountsChanged", handleWalletChange);
      provider?.removeListener?.("chainChanged", handleWalletChange);
    };
  }, []);

  return { transactions, loading, refetch };
}
