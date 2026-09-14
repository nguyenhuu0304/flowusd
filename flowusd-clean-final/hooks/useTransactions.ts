"use client";

import { useCallback, useEffect, useState } from "react";

import { getTransactions } from "@/services/transaction.service";
import type { Transaction } from "@/types/transaction";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
      return data;
    } catch (error) {
      console.error("Failed to load transactions:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      setLoading(true);

      try {
        const data = await getTransactions();
        if (active) setTransactions(data);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTransactions();

    return () => {
      active = false;
    };
  }, []);

  return {
    transactions,
    loading,
    refetch,
  };
}
