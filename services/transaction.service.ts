import {
  getTransactions as getTransactionsApi,
  getTransaction as getTransactionApi,
} from "@/lib/api/transaction";

import type { Transaction } from "@/types/transaction";

export async function getTransactions(): Promise<Transaction[]> {
  return getTransactionsApi();
}

export async function getTransaction(
  id: string
): Promise<Transaction | null> {
  try {
    return await getTransactionApi(id);
  } catch {
    return null;
  }
}
