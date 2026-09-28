"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
} from "lucide-react";

import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
}

export default function ActivityTimeline() {
  const { transactions, loading } = useTransactions();

  const recent = transactions.slice(0, 4);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-slate-900">
        Recent Activity
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-slate-500">
          No recent activity yet.
        </p>
      ) : (
        <div className="space-y-6">
          {recent.map((tx) => {
            const Icon =
              tx.type === "income"
                ? ArrowDownLeft
                : ArrowUpRight;

            const color =
              tx.type === "income"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600";

            return (
              <div key={tx.id} className="flex gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}
                >
                  <Icon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {tx.type === "income" ? "Received from" : "Sent to"}{" "}
                    {tx.name}
                  </p>

                  <p className="truncate text-sm text-slate-500">
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(Math.abs(tx.amount))} {CURRENCY}
                  </p>

                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={12} />
                    {timeAgo(tx.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
