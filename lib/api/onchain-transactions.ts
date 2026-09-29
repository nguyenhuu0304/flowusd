
import type { Transaction } from "@/types/transaction";

export type ArcTransactionPage = {
  transactions: Transaction[];
  scannedFrom: number;
  scannedTo: number;
  nextBefore: number | null;
};

async function requestTransactions(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(
      payload?.error ||
        `Arc transaction API failed (${response.status}).`
    );
  }

  return response.json();
}

// Keep this function for existing dashboard components.
export async function getArcOnChainTransactions(
  address: string
): Promise<Transaction[]> {
  return (await requestTransactions(
    `/api/arc/transactions?address=${encodeURIComponent(address)}`
  )) as Transaction[];
}

// Retrieve one page of on-chain history.
// "before" represents a block number.
export async function getArcOnChainTransactionPage(
  address: string,
  before?: number
): Promise<ArcTransactionPage> {
  const params = new URLSearchParams({
    address,
    paged: "1",
  });

  if (before !== undefined) {
    params.set("before", String(before));
  }

  return (await requestTransactions(
    `/api/arc/transactions?${params.toString()}`
  )) as ArcTransactionPage;
}
