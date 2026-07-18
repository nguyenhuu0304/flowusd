import { getTransactions } from "@/services/transaction.service";

export function useTransactions() {
  const transactions = getTransactions();

  return {
    transactions,
  };
}