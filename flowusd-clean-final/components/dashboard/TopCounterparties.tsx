"use client";

import { useMemo } from "react";

import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export default function TopCounterparties() {
  const { transactions, loading } = useTransactions();

  const counterparties = useMemo(() => {
    const byName = new Map<
      string,
      { name: string; total: number; count: number }
    >();

    for (const tx of transactions) {
      const existing = byName.get(tx.name);

      if (existing) {
        existing.total += Math.abs(tx.amount);
        existing.count += 1;
      } else {
        byName.set(tx.name, {
          name: tx.name,
          total: Math.abs(tx.amount),
          count: 1,
        });
      }
    }

    return Array.from(byName.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          Top Counterparties
        </h2>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : counterparties.length === 0 ? (
        <p className="text-sm text-slate-500">
          No transactions yet.
        </p>
      ) : (
        <div className="space-y-4">
          {counterparties.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {entry.name}
                </p>

                <p className="text-sm text-slate-500">
                  {entry.count}{" "}
                  {entry.count === 1 ? "transaction" : "transactions"}
                </p>
              </div>

              <p className="font-semibold text-slate-900">
                {formatCurrency(entry.total)} {CURRENCY}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
