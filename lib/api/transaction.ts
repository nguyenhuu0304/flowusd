import { api } from "./client";

export type TransactionApi = {
  id: string;
  name: string;
  address: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  createdAt: string;
  memo?: string;
};

export async function getTransactions() {
  return api<TransactionApi[]>("/transactions");
}

export async function getTransaction(id: string) {
  return api<TransactionApi>(`/transactions/${id}`);
}
