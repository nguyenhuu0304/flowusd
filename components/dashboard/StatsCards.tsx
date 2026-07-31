"use client";

import { useMemo } from "react";

import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function StatsCards() {
  const { transactions, loading } = useTransactions();

  const stats = useMemo(() => {
    const now = new Date();

    const thisMonth = transactions.filter((tx) => {
      const date = new Date(tx.createdAt);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    });

    const monthlyVolume = thisMonth.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0
    );

    const completed = transactions.filter(
      (tx) => tx.status === "completed"
    ).length;

    const pending = transactions.filter(
      (tx) => tx.status === "pending"
    ).length;

    const successRate =
      transactions.length === 0
        ? 100
        : (completed / transactions.length) * 100;

    return [
      {
        title: "Total Transactions",
        value: formatNumber(transactions.length),
        color: "text-blue-600",
      },
      {
        title: "Monthly Volume",
        value: `${formatCurrency(monthlyVolume)} ${CURRENCY}`,
        color: "text-emerald-600",
      },
      {
        title: "Success Rate",
        value: `${successRate.toFixed(1)}%`,
        color: "text-violet-600",
      },
      {
        title: "Pending",
        value: formatNumber(pending),
        color: "text-amber-600",
      },
    ];
  }, [transactions]);

  if (loading) {
    return (
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-slate-500">
            {stat.title}
          </p>

          <h3 className={`mt-3 text-3xl font-bold ${stat.color}`}>
            {stat.value}
          </h3>
        </div>
      ))}
    </section>
  );
}
