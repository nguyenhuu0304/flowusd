"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Search,
  XCircle,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import { useTransactions } from "@/hooks/useTransactions";

import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { explorerTxUrl } from "@/lib/web3/config";
import { shortenAddress } from "@/lib/utils";

type FilterType = "all" | "income" | "expense";

function Status({
  status,
}: {
  status: "completed" | "pending" | "failed";
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 size={14} />
        Confirmed
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
        <XCircle size={14} />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
      <Clock3 size={14} />
      Pending
    </span>
  );
}

export default function TransactionHistory() {
  const {
    transactions,
    loading,
    source,
  } = useTransactions();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredTransactions = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return transactions.filter((tx) => {
      const matchSearch =
        !keyword ||
        tx.name.toLowerCase().includes(keyword) ||
        tx.address.toLowerCase().includes(keyword) ||
        tx.id.toLowerCase().includes(keyword);

      const matchFilter =
        filter === "all" || tx.type === filter;

      return matchSearch && matchFilter;
    });
  }, [transactions, search, filter]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-xl bg-slate-200"
            />
          ))}
        </div>
      </Card>
    );
  }

  const hasOnChain = source === "onchain";

  return (
    <Card className="p-6">
      {/* DATA SOURCE */}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {hasOnChain
            ? "Live USDC transfers read directly from your connected Arc wallet."
            : "Demo history is shown until an Arc wallet is connected."}
        </p>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            hasOnChain
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {hasOnChain ? "On-chain" : "Demo data"}
        </span>
      </div>

      {/* SEARCH + FILTER */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search address or transaction hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-blue-600"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={
              filter === "all"
                ? "default"
                : "outline"
            }
            onClick={() => setFilter("all")}
          >
            All
          </Button>

          <Button
            variant={
              filter === "income"
                ? "default"
                : "outline"
            }
            onClick={() => setFilter("income")}
          >
            Received
          </Button>

          <Button
            variant={
              filter === "expense"
                ? "default"
                : "outline"
            }
            onClick={() => setFilter("expense")}
          >
            Sent
          </Button>
        </div>
      </div>

      {/* TABLE */}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-slate-500">
              <th className="pb-4">
                Transaction
              </th>

              <th className="pb-4">
                Date
              </th>

              <th className="pb-4">
                Status
              </th>

              <th className="pb-4 text-right">
                Amount
              </th>

              <th className="pb-4 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.map((tx) => {
              const hash = tx.hash ?? tx.id;

              const onChain =
                tx.source === "onchain" &&
                hash.startsWith("0x");

              return (
                <tr
                  key={`${tx.id}-${tx.type}-${tx.address}`}
                  className="border-b transition hover:bg-slate-50"
                >
                  {/* TRANSACTION */}

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

                        <p className="max-w-[260px] truncate text-sm text-slate-500">
                          {tx.address}
                        </p>

                        {onChain && (
                          <a
                            href={explorerTxUrl(hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline"
                          >
                            Tx {shortenAddress(hash)}
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* DATE */}

                  <td className="text-sm text-slate-500">
                    {formatDate(tx.createdAt)}
                  </td>

                  {/* STATUS */}

                  <td>
                    <Status status={tx.status} />
                  </td>

                  {/* AMOUNT */}

                  <td
                    className={`text-right font-semibold ${
                      tx.type === "income"
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {tx.type === "income"
                      ? "+"
                      : "-"}

                    {formatCurrency(
                      Math.abs(tx.amount)
                    )}{" "}
                    {CURRENCY}
                  </td>

                  {/* ACTION */}

                  <td className="text-right">
                    <Link
                      href={`/transactions/${encodeURIComponent(
                        tx.id
                      )}`}
                    >
                      <Button variant="outline">
                        Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}

            {filteredTransactions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-slate-500"
                >
                  {hasOnChain
                    ? "No recent on-chain USDC transactions found for this wallet."
                    : "No transactions found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}