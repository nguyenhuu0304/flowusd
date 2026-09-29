
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";

import {
  getArcOnChainTransactionPage,
} from "@/lib/api/onchain-transactions";

import type { Transaction } from "@/types/transaction";

export type TransactionDataSource = "onchain" | "mock";

function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const unique = new Map<string, Transaction>();

  for (const transaction of [...existing, ...incoming]) {
    const key = String(transaction.id);

    if (!unique.has(key)) {
      unique.set(key, transaction);
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );
}

export function useTransactions() {
  const wallet = useWeb3Wallet();

  const address = wallet.address;
  const isOnArcTestnet = wallet.isOnArcTestnet;

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [source] =
    useState<TransactionDataSource>("onchain");

  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [nextBefore, setNextBefore] =
    useState<number | null>(null);

  const [hasMore, setHasMore] = useState(false);

  const requestIdRef = useRef(0);
  const loadingOlderRef = useRef(false);

  const refetch = useCallback(
    async (): Promise<Transaction[]> => {
      const requestId = ++requestIdRef.current;

      setTransactions([]);
      setNextBefore(null);
      setHasMore(false);
      setError(null);
      setLoadingOlder(false);
      loadingOlderRef.current = false;

      if (!address || !isOnArcTestnet) {
        setLoading(false);
        return [];
      }

      setLoading(true);

      try {
        const page =
          await getArcOnChainTransactionPage(address);

        if (requestId !== requestIdRef.current) {
          return [];
        }

        const result = mergeTransactions(
          [],
          page.transactions
        );

        setTransactions(result);
        setNextBefore(page.nextBefore);
        setHasMore(page.nextBefore !== null);

        return result;
      } catch (caughtError) {
        if (requestId !== requestIdRef.current) {
          return [];
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Arc transactions.";

        console.error(
          "[Transactions] Loading failed:",
          caughtError
        );

        setTransactions([]);
        setError(message);

        return [];
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [address, isOnArcTestnet]
  );

  const loadOlder = useCallback(
    async (): Promise<Transaction[]> => {
      if (
        !address ||
        !isOnArcTestnet ||
        nextBefore === null ||
        loadingOlderRef.current ||
        loading
      ) {
        return [];
      }

      const requestId = requestIdRef.current;

      loadingOlderRef.current = true;
      setLoadingOlder(true);
      setError(null);

      try {
        const page =
          await getArcOnChainTransactionPage(
            address,
            nextBefore
          );

        if (requestId !== requestIdRef.current) {
          return [];
        }

        setTransactions((previous) =>
          mergeTransactions(
            previous,
            page.transactions
          )
        );

        setNextBefore(page.nextBefore);
        setHasMore(page.nextBefore !== null);

        return page.transactions;
      } catch (caughtError) {
        if (requestId !== requestIdRef.current) {
          return [];
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load older transactions.";

        console.error(
          "[Transactions] Load older failed:",
          caughtError
        );

        setError(message);

        return [];
      } finally {
        if (requestId === requestIdRef.current) {
          loadingOlderRef.current = false;
          setLoadingOlder(false);
        }
      }
    },
    [
      address,
      isOnArcTestnet,
      nextBefore,
      loading,
    ]
  );

  useEffect(() => {
    void refetch();

    return () => {
      requestIdRef.current++;
    };
  }, [refetch]);

  return {
    transactions,
    source,
    loading,
    error,
    refetch,

    // Pagination
    loadOlder,
    loadingOlder,
    hasMore,
    nextBefore,
  };
}
