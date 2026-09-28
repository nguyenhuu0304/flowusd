import type { Transaction } from "@/types/transaction";

export async function getArcOnChainTransactions(
  address: string
): Promise<Transaction[]> {
  const response = await fetch(
    `/api/arc/transactions?address=${encodeURIComponent(address)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error ||
      `Arc transaction API failed with status ${response.status}.`;
    throw new Error(message);
  }

  return response.json();
}
