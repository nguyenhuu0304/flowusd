"use client";

import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

export default function AnalyticsDashboard() {
  const { transactions, loading } = useTransactions();

  const analytics = useMemo(() => {
    const completed = transactions.filter((tx) => tx.status === "completed");
    const incoming = completed
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const outgoing = completed
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalVolume = incoming + outgoing;
    const successRate =
      transactions.length === 0 ? 100 : (completed.length / transactions.length) * 100;

    const months: { key: string; label: string; incoming: number; outgoing: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(date), label: monthLabel(date), incoming: 0, outgoing: 0 });
    }

    for (const tx of completed) {
      const key = monthKey(new Date(tx.createdAt));
      const bucket = months.find((month) => month.key === key);
      if (!bucket) continue;

      if (tx.type === "income") bucket.incoming += Math.abs(tx.amount);
      else bucket.outgoing += Math.abs(tx.amount);
    }

    const monthlyData = months.map(({ label, incoming: inc, outgoing: out }) => ({
      month: label,
      incoming: Math.round(inc * 100) / 100,
      outgoing: Math.round(out * 100) / 100,
      volume: Math.round((inc + out) * 100) / 100,
    }));

    const counterparties = new Map<string, { name: string; volume: number; count: number }>();
    for (const tx of completed) {
      const current = counterparties.get(tx.name) ?? { name: tx.name, volume: 0, count: 0 };
      current.volume += Math.abs(tx.amount);
      current.count += 1;
      counterparties.set(tx.name, current);
    }

    const topCounterparties = Array.from(counterparties.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      incoming,
      outgoing,
      totalVolume,
      netFlow: incoming - outgoing,
      successRate,
      completedCount: completed.length,
      monthlyData,
      topCounterparties,
    };
  }, [transactions]);

  const cards = [
    {
      label: "Total Volume",
      value: `${formatCurrency(analytics.totalVolume)} ${CURRENCY}`,
      helper: `${formatNumber(analytics.completedCount)} completed payments`,
      icon: CircleDollarSign,
      accent: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      label: "Incoming",
      value: `${formatCurrency(analytics.incoming)} ${CURRENCY}`,
      helper: "Completed received payments",
      icon: ArrowDownLeft,
      accent: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Outgoing",
      value: `${formatCurrency(analytics.outgoing)} ${CURRENCY}`,
      helper: "Completed sent payments",
      icon: ArrowUpRight,
      accent: "text-rose-600",
      iconBg: "bg-rose-50",
    },
    {
      label: "Success Rate",
      value: `${analytics.successRate.toFixed(1)}%`,
      helper: `Net flow ${analytics.netFlow >= 0 ? "+" : "-"}${formatCurrency(Math.abs(analytics.netFlow))} ${CURRENCY}`,
      icon: Gauge,
      accent: "text-violet-600",
      iconBg: "bg-violet-50",
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Analytics"
          description="Understand payment volume, cash flow, and counterparties from your FlowUSD activity."
        />

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    {loading ? (
                      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-100" />
                    ) : (
                      <p className={`mt-3 text-2xl font-bold ${card.accent}`}>{card.value}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{card.helper}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${card.iconBg} ${card.accent}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-8 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Six-month payment volume</h2>
                <p className="mt-1 text-sm text-slate-500">Completed incoming and outgoing USDC activity.</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="h-80">
              {loading ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.monthlyData}>
                    <defs>
                      <linearGradient id="analyticsVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ${CURRENCY}`, "Volume"]} />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fill="url(#analyticsVolume)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Cash flow by month</h2>
              <p className="mt-1 text-sm text-slate-500">Compare money in versus money out.</p>
            </div>

            <div className="h-80">
              {loading ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${Number(value).toLocaleString()} ${CURRENCY}`} />
                    <Legend />
                    <Bar dataKey="incoming" name="Incoming" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="outgoing" name="Outgoing" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Top counterparties</h2>
              <p className="mt-1 text-sm text-slate-500">People and businesses with the most completed payment volume.</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : analytics.topCounterparties.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No completed transactions yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {analytics.topCounterparties.map((entry, index) => (
                <div key={entry.name} className="rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {entry.count} tx
                    </span>
                  </div>
                  <p className="mt-4 truncate font-semibold text-slate-900">{entry.name}</p>
                  <p className="mt-2 text-sm font-medium text-blue-600">
                    {formatCurrency(entry.volume)} {CURRENCY}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
