"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import { useTransactions } from "@/hooks/useTransactions";

import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

export default function RecentTransactions() {
  const { transactions, loading } = useTransactions();

  if (loading) {
    return (
      <Card>
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-slate-200"
            />
          ))}
        </div>
      </Card>
    );
  }

  const recent = transactions.slice(0, 5);

  return (
    <Card>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Recent Transactions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Latest wallet activity.
          </p>
        </div>

        <Link href="/transactions">
          <Button variant="outline">
            View All
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-slate-500">
              <th className="pb-3 font-medium">
                Transaction
              </th>

              <th className="pb-3 font-medium">
                Date
              </th>

              <th className="pb-3 font-medium">
                Status
              </th>

              <th className="pb-3 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {recent.map((tx) => (
              <tr
                key={tx.id}
                className="border-b last:border-0 transition hover:bg-slate-50"
              >
                <td className="py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.type === "income"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {tx.type === "income" ? (
                        <ArrowDownLeft size={18} />
                      ) : (
                        <ArrowUpRight size={18} />
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {tx.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {tx.address}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="text-sm text-slate-500">
                  {formatDate(tx.createdAt)}
                </td>

                <td>
                  {tx.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      <CheckCircle2 size={14} />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                      <Clock3 size={14} />
                      Pending
                    </span>
                  )}
                </td>

                <td
                  className={`text-right font-semibold ${
                    tx.type === "income"
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatCurrency(Math.abs(tx.amount))}{" "}
                  {CURRENCY}
                </td>
              </tr>
            ))}

            {recent.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-slate-500"
                >
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}