"use client";

import { useCallback, useEffect, useState } from "react";

import { getTransactions as getMockTransactions } from "@/services/transaction.service";
import { getArcOnChainTransactions } from "@/lib/api/onchain-transactions";
import type { Transaction } from "@/types/transaction";
import { FLOWUSD_CONNECTED_ADDRESS_KEY } from "@/hooks/useWeb3Wallet";

export type TransactionDataSource = "onchain" | "mock";

async function loadTransactions(): Promise<{
  transactions: Transaction[];
  source: TransactionDataSource;
}> {
  const connectedAddress =
    typeof window !== "undefined"
      ? window.localStorage.getItem(FLOWUSD_CONNECTED_ADDRESS_KEY)
      : null;

  if (connectedAddress) {
    try {
      const onChain = await getArcOnChainTransactions(connectedAddress);
      return { transactions: onChain, source: "onchain" };
    } catch (error) {
      console.error("Failed to load Arc on-chain transactions:", error);
    }
  }

  const fallback = await getMockTransactions();

  return {
    transactions: fallback.map((tx) => ({
      ...tx,
      source: "mock" as const,
    })),
    source: "mock",
  };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [source, setSource] = useState<TransactionDataSource>("mock");
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const result = await loadTransactions();
      setTransactions(result.transactions);
      setSource(result.source);
      return result.transactions;
    } catch (error) {
      console.error("Failed to load transactions:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await loadTransactions();

        if (active) {
          setTransactions(result.transactions);
          setSource(result.source);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    function handleFocus() {
      void load();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return {
    transactions,
    source,
    loading,
    refetch,
  };
}
