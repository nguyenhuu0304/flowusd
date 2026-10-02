﻿"use client";

import { useState } from "react";
import {
  CheckCircle2,
  History,
  RefreshCw,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { useAppearance } from "@/contexts/AppearanceContext";

import BillCloudBridge from "@/components/dashboard/BillCloudBridge";
import TransactionHistory from "@/components/dashboard/TransactionHistory";
import SplitBillBatchCard from "@/components/dashboard/SplitBillBatchCard";

type DashboardTab =
  | "transactions"
  | "split";

export default function DashboardContent() {
  const wallet = useWeb3Wallet();
  const { language, t } = useAppearance();

  const vi = language === "vi";

  const [activeTab, setActiveTab] =
    useState<DashboardTab>("split");

  const connected = Boolean(
    wallet.address &&
      wallet.provider
  );

  const ready =
    connected &&
    wallet.isOnArcTestnet;

  const balance =
    ready &&
    wallet.balance !== null
      ? `${wallet.balance} USDC`
      : "— USDC";

  const connectionStatus = ready
    ? vi
      ? "Đã kết nối Arc Testnet"
      : "Arc Testnet Connected"
    : connected
      ? t("wrongNetwork")
      : t("disconnected");

  const shortWallet =
    wallet.address
      ? `${wallet.address.slice(
          0,
          6
        )}…${wallet.address.slice(
          -4
        )}`
      : "";

  const tabs: Array<{
    id: DashboardTab;
    label: string;
    description: string;
    icon: typeof ReceiptText;
  }> = [
    {
      id: "split",
      label: vi
        ? "Chia hóa đơn"
        : "Split Bill",
      description: vi
        ? "Tạo bill & gửi Telegram"
        : "Create bills & notify members",
      icon: ReceiptText,
    },
    {
      id: "transactions",
      label: t("transactions"),
      description: vi
        ? "Lịch sử on-chain"
        : "On-chain history",
      icon: History,
    },
  ];

  return (
    <main className="min-h-full flex-1 bg-slate-50 px-4 py-6 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <BillCloudBridge />

      <div className="mx-auto max-w-5xl space-y-5">

        {/* Compact header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {t("dashboard")}
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {vi
                ? "Tạo và theo dõi thanh toán USDC trên Arc."
                : "Create and track USDC payments on Arc."}
            </p>
          </div>

          {wallet.address && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {shortWallet}
            </span>
          )}
        </header>

        {/* Compact wallet overview */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Wallet size={15} />
                {t("usdcBalance")}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <strong className="text-2xl font-bold">
                  {wallet.loadingBalance
                    ? t("loading")
                    : balance}
                </strong>

                {ready && (
                  <button
                    type="button"
                    disabled={
                      wallet.loadingBalance
                    }
                    onClick={() =>
                      void wallet.refreshBalance()
                    }
                    title={t("refresh")}
                    aria-label={t("refresh")}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw
                      size={16}
                      className={
                        wallet.loadingBalance
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </button>
                )}
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                ready
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : connected
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <CheckCircle2 size={14} />
              {connectionStatus}
            </span>
          </div>

          {!ready && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {vi
                ? "Kết nối ví và chuyển sang Arc Testnet để sử dụng thanh toán."
                : "Connect your wallet and switch to Arc Testnet to use payments."}
            </p>
          )}
        </section>

        {/* Friendly action tabs */}
        <nav
          className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2"
          role="tablist"
          aria-label={
            vi
              ? "Chức năng thanh toán"
              : "Payment sections"
          }
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  setActiveTab(tab.id)
                }
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    active
                      ? "bg-white/15"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  <Icon size={18} />
                </span>

                <span className="min-w-0">
                  <span className="block font-semibold">
                    {tab.label}
                  </span>

                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      active
                        ? "text-blue-100"
                        : "text-slate-400"
                    }`}
                  >
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active workspace only */}
        <section role="tabpanel">
          {activeTab ===
            "transactions" ? (
            <TransactionHistory />
          ) : (
            <SplitBillBatchCard />
          )}
        </section>

        <p className="pb-4 text-center text-xs text-slate-400 dark:text-slate-500">
          FlowUSD · Arc Testnet ·{" "}
          {vi
            ? "Thanh toán USDC on-chain"
            : "On-chain USDC Payments"}
        </p>
      </div>
    </main>
  );
}
