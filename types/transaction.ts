export interface Transaction {
  id: string;
  name: string;
  address: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  createdAt: string;
}