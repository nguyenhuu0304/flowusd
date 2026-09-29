"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { getArcOnChainTransactionPage, type ArcTransactionPage } from "@/lib/api/onchain-transactions";
import type { Transaction } from "@/types/transaction";

export type TransactionDataSource = "onchain" | "mock";
type Cache = { savedAt: number; page: ArcTransactionPage; transactions: Transaction[] };
const CACHE_MS = 5 * 60_000;
const COOLDOWN_MS = 30_000;
function key(address: string) { return `flowusd:tx-cache:v2:${address.toLowerCase()}`; }
function read(address: string): Cache | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(address)) || "null") as Cache | null;
    if (!value || !Array.isArray(value.transactions) || !value.page || !Number.isFinite(value.savedAt)) return null;
    if (Date.now() - value.savedAt > CACHE_MS) return null;
    return value;
  } catch { return null; }
}
function save(address: string, cached: Cache) {
  try { localStorage.setItem(key(address), JSON.stringify(cached)); } catch { /* quota or private mode */ }
}
function merge(current: Transaction[], incoming: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  for (const item of [...incoming, ...current]) map.set(String(item.id), item);
  return [...map.values()].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
}
export function useTransactions() {
  const wallet = useWeb3Wallet();
  const address = wallet.address;
  const onArc = wallet.isOnArcTestnet;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);
  const busy = useRef(false);
  const lastRateLimit = useRef(0);
  const ready = Boolean(address && onArc);
  const applyPage = useCallback((page: ArcTransactionPage, isOlder: boolean) => {
    setTransactions(previous => isOlder ? merge(previous, page.transactions) : merge([], page.transactions));
    setNextBefore(page.nextBefore);
    setHasMore(page.nextBefore !== null);
  },[]);
  const refetch = useCallback(async (): Promise<Transaction[]> => {
    if (!address || !onArc) { setTransactions([]); setHasMore(false); setNextBefore(null); setError(null); setLoading(false); return []; }
    if (busy.current) return [];
    if (Date.now() - lastRateLimit.current < COOLDOWN_MS) { setError("Arc RPC is rate limited. Wait 30 seconds before refreshing."); return []; }
    const currentRequest = requestId.current;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await getArcOnChainTransactionPage(address);
      if (currentRequest !== requestId.current) return [];
      applyPage(page, false);
      save(address, { savedAt: Date.now(), page, transactions: page.transactions });
      return page.transactions;
    } catch (caught) {
      if (currentRequest !== requestId.current) return [];
      const message = caught instanceof Error ? caught.message : "Transaction history unavailable";
      if (/429|rate.limit|too many/i.test(message)) lastRateLimit.current = Date.now();
      // Deliberately preserve the current and cached transactions after failure.
      setError(message);
      return [];
    } finally { if (currentRequest === requestId.current) { busy.current = false; setLoading(false); } }
  }, [address, onArc, applyPage]);
  const loadOlder = useCallback(async (): Promise<Transaction[]> => {
    if (!address || !onArc || nextBefore === null || busy.current) return [];
    if (Date.now() - lastRateLimit.current < COOLDOWN_MS) { setError("Arc RPC is rate limited. Wait 30 seconds before retrying."); return []; }
    const currentRequest = requestId.current;
    busy.current = true; setLoadingOlder(true); setError(null);
    try {
      const page = await getArcOnChainTransactionPage(address, nextBefore);
      if (currentRequest !== requestId.current) return [];
      setTransactions(previous => {
        const combined = merge(previous, page.transactions);
        const latest = read(address);
        save(address, { savedAt: Date.now(), page: latest?.page ?? page, transactions: combined.slice(0, 150) });
        return combined;
      });
      setNextBefore(page.nextBefore); setHasMore(page.nextBefore !== null);
      return page.transactions;
    } catch (caught) {
      if (currentRequest !== requestId.current) return [];
      const message = caught instanceof Error ? caught.message : "Unable to load older transactions";
      if (/429|rate.limit|too many/i.test(message)) lastRateLimit.current = Date.now();
      setError(message); return [];
    } finally { if (currentRequest === requestId.current) { busy.current = false; setLoadingOlder(false); } }
  },[address,onArc,nextBefore]);
  useEffect(() => {
    requestId.current++;
    busy.current = false;
    lastRateLimit.current = 0;
    if (!address || !onArc) { setTransactions([]); setNextBefore(null); setHasMore(false); setError(null); return; }
    const cached = read(address);
    if (cached) { setTransactions(cached.transactions); setNextBefore(cached.page.nextBefore); setHasMore(cached.page.nextBefore !== null); }
    else { setTransactions([]); setNextBefore(null); setHasMore(false); }
    void refetch();
    return () => { requestId.current++; };
  },[address,onArc,refetch]);
  return { transactions, source: "onchain" as TransactionDataSource, loading, loadingOlder, error, nextBefore, hasMore, refetch, loadOlder };
}
