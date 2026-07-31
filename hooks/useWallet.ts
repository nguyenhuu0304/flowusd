"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getWallet,
  Wallet,
} from "@/services/wallet.service";

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(
    null
  );

  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data = await getWallet();
      setWallet(data);
      return data;
    } catch (error) {
      console.error("Failed to load wallet:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      setLoading(true);

      try {
        const data = await getWallet();
        if (active) setWallet(data);
      } catch (error) {
        console.error("Failed to load wallet:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWallet();

    return () => {
      active = false;
    };
  }, []);

  return {
    wallet,
    loading,
    refetch,
  };
}
