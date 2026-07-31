"use client";

import { CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

type Props = {
  amount: number;
  type: "income" | "expense";
};

export default function TransactionAmount({
  amount,
  type,
}: Props) {
  return (
    <span
      className={`font-semibold ${
        type === "income"
          ? "text-green-600"
          : "text-red-500"
      }`}
    >
      {type === "income" ? "+" : "-"}
      {formatCurrency(Math.abs(amount))} {CURRENCY}
    </span>
  );
}