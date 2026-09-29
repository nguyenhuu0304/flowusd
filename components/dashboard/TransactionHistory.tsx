
"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { useTransactions } from "@/hooks/useTransactions";
import { useAppearance } from "@/contexts/AppearanceContext";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { explorerTxUrl } from "@/lib/web3/config";
import { shortenAddress } from "@/lib/utils";

type FilterType = "all" | "income" | "expense";

type StatusType = "completed" | "pending" | "failed";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-slate-300 bg-white px-4 py-2 text-sm font-semibold " +
  "text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed " +
  "disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 " +
  "dark:text-slate-100 dark:hover:bg-slate-700";

function TransactionStatus({
  status,
}: {
  status: StatusType;
}) {
  const { t } = useAppearance();

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 size={14} />
        {t("confirmed")}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        <XCircle size={14} />
        {t("failed")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      <Clock3 size={14} />
      {t("pending")}
    </span>
  );
}

export default function TransactionHistory() {
  const {
    transactions,
    loading,
    loadingOlder,
    error,
    hasMore,
    nextBefore,
    loadOlder,
    refetch,
  } = useTransactions();

  const { language, t } = useAppearance();

  const vi = language === "vi";

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<FilterType>("all");

  const filteredTransactions = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return transactions.filter((tx) => {
      const matchSearch =
        !keyword ||
        tx.name.toLowerCase().includes(keyword) ||
        tx.address.toLowerCase().includes(keyword) ||
        String(tx.id).toLowerCase().includes(keyword) ||
        (tx.hash ?? "").toLowerCase().includes(keyword);

      const matchFilter =
        filter === "all" || tx.type === filter;

      return matchSearch && matchFilter;
    });
  }, [transactions, search, filter]);

  function displayDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString(
      vi ? "vi-VN" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-6">
      {/* Heading */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {t("transactionHistory")}
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {vi
              ? "Lịch sử chuyển USDC thực trên blockchain Arc Testnet."
              : "Real USDC transfers from Arc Testnet blockchain."}
          </p>
        </div>

        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          On-chain
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <p className="font-semibold">
            {vi
              ? "Lỗi tải lịch sử blockchain"
              : "Blockchain history error"}
          </p>

          <p className="mt-2 break-words">
            {error}
          </p>

          <p className="mt-2 text-xs">
            {vi
              ? "Nếu Arc RPC giới hạn truy vấn, hãy đợi một lúc trước khi thử lại."
              : "If Arc RPC is rate limited, wait a moment before trying again."}
          </p>
        </div>
      )}

      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={
              vi
                ? "Tìm địa chỉ ví hoặc mã giao dịch..."
                : "Search wallet or transaction hash..."
            }
            aria-label={
              vi
                ? "Tìm kiếm giao dịch"
                : "Search transactions"
            }
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", t("all")],
              ["income", t("received")],
              ["expense", t("sent")],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={
                filter === value
                  ? "rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  : secondaryButton
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* History table */}
      {loading ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {vi
              ? "Đang đọc lịch sử từ Arc Testnet..."
              : "Loading transactions from Arc Testnet..."}
          </p>

          {Array.from({ length: 4 }).map(
            (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            )
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="pb-4 font-medium">
                  {vi ? "Giao dịch" : "Transaction"}
                </th>

                <th className="pb-4 font-medium">
                  {t("date")}
                </th>

                <th className="pb-4 font-medium">
                  {t("status")}
                </th>

                <th className="pb-4 text-right font-medium">
                  {t("amount")}
                </th>

                <th className="pb-4 text-right font-medium">
                  {t("action")}
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((tx) => {
                const hash = tx.hash ?? "";

                const hasValidHash =
                  /^0x[a-fA-F0-9]{64}$/.test(
                    hash
                  );

                return (
                  <tr
                    key={`${tx.id}-${tx.type}-${tx.address}`}
                    className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            tx.type === "income"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <ArrowDownLeft size={18} />
                          ) : (
                            <ArrowUpRight size={18} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">
                            {tx.type === "income"
                              ? vi
                                ? "Nhận USDC"
                                : "Received USDC"
                              : vi
                                ? "Gửi USDC"
                                : "Sent USDC"}
                          </p>

                          <p className="max-w-[240px] truncate text-xs text-slate-500 dark:text-slate-400">
                            {tx.address}
                          </p>

                          {hasValidHash && (
                            <p className="mt-1 font-mono text-xs text-slate-400">
                              Tx{" "}
                              {shortenAddress(hash)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 text-sm text-slate-500 dark:text-slate-400">
                      {displayDate(tx.createdAt)}
                    </td>

                    <td className="py-4">
                      <TransactionStatus
                        status={tx.status}
                      />
                    </td>

                    <td
                      className={`py-4 text-right font-semibold ${
                        tx.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(
                        Math.abs(tx.amount)
                      )}{" "}
                      {CURRENCY}
                    </td>

                    <td className="py-4 text-right">
                      {hasValidHash ? (
                        <a
                          href={explorerTxUrl(hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          {vi ? "Xem" : "View"}
                          <ExternalLink size={15} />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {vi
                            ? "Không khả dụng"
                            : "Unavailable"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    {error
                      ? vi
                        ? "Không thể tải lịch sử giao dịch."
                        : "Transaction history could not be loaded."
                      : transactions.length > 0
                        ? vi
                          ? "Không có giao dịch phù hợp với bộ lọc."
                          : "No transactions match your search or filter."
                        : t("noTransactions")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination and refresh */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>
            {vi ? "Đã tải" : "Loaded"}:{" "}
            {transactions.length}{" "}
            {vi ? "giao dịch" : "transactions"}
          </p>

          {nextBefore !== null && (
            <p className="mt-1">
              {vi
                ? "Có thể tải các block cũ hơn mốc"
                : "Older blocks available below"}{" "}
              {nextBefore.toLocaleString(
                vi ? "vi-VN" : "en-US"
              )}.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={loading || loadingOlder}
            onClick={() => void refetch()}
          >
            <RefreshCw size={15} />
            {t("refresh")}
          </button>

          {hasMore && nextBefore !== null && (
            <button
              type="button"
              className={secondaryButton}
              disabled={loading || loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder
                ? vi
                  ? "Đang quét các block cũ..."
                  : "Scanning older blocks..."
                : t("loadOlder")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
