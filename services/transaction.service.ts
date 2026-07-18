import { Transaction } from "@/types/transaction";

export const transactions: Transaction[] = [
  {
    id: "tx-001",
    name: "Coffee Shop",
    address: "0xA91C...5F12",
    amount: -5.2,
    type: "expense",
    status: "completed",
    createdAt: "2026-07-18",
  },
  {
    id: "tx-002",
    name: "Salary",
    address: "Company Payroll",
    amount: 2500,
    type: "income",
    status: "completed",
    createdAt: "2026-07-17",
  },
];

export function getTransactions() {
  return transactions;
}