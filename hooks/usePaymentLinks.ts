"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createPaymentLink,
  listPaymentLinks,
  PaymentLinkApi,
} from "@/lib/api/payment-links";

export function usePaymentLinks() {
  const [links, setLinks] = useState<PaymentLinkApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const data = await listPaymentLinks();
      setLinks(data);
      return data;
    } catch (error) {
      console.error("Failed to load payment links:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const data = await listPaymentLinks();
        if (active) setLinks(data);
      } catch (error) {
        console.error("Failed to load payment links:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function create(data: { amount?: number | null; memo?: string }) {
    setCreating(true);

    try {
      const link = await createPaymentLink(data);
      setLinks((prev) => [link, ...prev]);
      return link;
    } finally {
      setCreating(false);
    }
  }

  return {
    links,
    loading,
    creating,
    create,
    refetch,
  };
}
