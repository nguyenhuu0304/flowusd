"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

import Button from "@/components/ui/Button";

import TransactionAmount from "./TransactionAmount";
import TransactionStatus from "./TransactionStatus";

import type { Transaction } from "@/types/transaction";

import { formatDate } from "@/lib/format";

type Props = {
  transaction: Transaction;
  showView?: boolean;
};

export default function TransactionRow({
  transaction,
  showView = false,
}: Props) {
  return (
    <tr className="border-b transition hover:bg-slate-50">
      <td className="py-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              transaction.type === "income"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {transaction.type === "income" ? (
              <ArrowDownLeft size={18} />
            ) : (
              <ArrowUpRight size={18} />
            )}
          </div>

          <div>
            <p className="font-semibold text-slate-900">
              {transaction.name}
            </p>

            <p className="text-sm text-slate-500">
              {transaction.address}
            </p>
          </div>
        </div>
      </td>

      <td className="text-sm text-slate-500">
        {formatDate(transaction.createdAt)}
      </td>

      <td>
        <TransactionStatus
          status={transaction.status}
        />
      </td>

      <td className="text-right">
        <TransactionAmount
          amount={transaction.amount}
          type={transaction.type}
        />
      </td>

      {showView && (
        <td className="text-right">
          <Link
            href={`/transactions/${transaction.id}`}
          >
            <Button variant="outline">
              View
            </Button>
          </Link>
        </td>
      )}
    </tr>
  );
}