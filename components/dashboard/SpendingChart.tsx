"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTransactions } from "@/hooks/useTransactions";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SpendingChart() {
  const { transactions, loading } = useTransactions();

  const { data, changePercent } = useMemo(() => {
    const days: { day: string; volume: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const volume = transactions
        .filter((tx) => {
          const txDate = new Date(tx.createdAt);
          return (
            txDate.getFullYear() === date.getFullYear() &&
            txDate.getMonth() === date.getMonth() &&
            txDate.getDate() === date.getDate()
          );
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      days.push({
        day: DAY_LABELS[date.getDay()],
        volume: Math.round(volume * 100) / 100,
      });
    }

    const firstHalf = days.slice(0, 3).reduce((s, d) => s + d.volume, 0);
    const secondHalf = days.slice(4).reduce((s, d) => s + d.volume, 0);

    const change =
      firstHalf === 0
        ? 0
        : ((secondHalf - firstHalf) / firstHalf) * 100;

    return { data: days, changePercent: change };
  }, [transactions]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Weekly Payment Volume
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            USDC transferred this week
          </p>
        </div>

        <div
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            changePercent >= 0
              ? "bg-blue-50 text-blue-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent.toFixed(0)}%
        </div>
      </div>

      <div className="h-80">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id="flowGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

              <XAxis dataKey="day" />

              <YAxis />

              <Tooltip />

              <Area
                type="monotone"
                dataKey="volume"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#flowGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
