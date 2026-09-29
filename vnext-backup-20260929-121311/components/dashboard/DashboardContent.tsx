
"use client";

import { useState } from "react";
import {
  CheckCircle2,
  History,
  Link2,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { useAppearance } from "@/contexts/AppearanceContext";

import PaymentLinksCard from "@/components/dashboard/PaymentLinksCard";
import TransactionHistory from "@/components/dashboard/TransactionHistory";

type DashboardTab = "payments" | "transactions";

export default function DashboardContent() {
  const wallet = useWeb3Wallet();

  const { language, t } = useAppearance();

  const [activeTab, setActiveTab] =
    useState<DashboardTab>("payments");

  const connected = Boolean(
    wallet.address && wallet.provider
  );

  const ready =
    connected && wallet.isOnArcTestnet;

  const balance =
    ready && wallet.balance !== null
      ? `${wallet.balance} USDC`
      : "— USDC";

  const connectionStatus = ready
    ? language === "vi"
      ? "Đã kết nối Arc Testnet"
      : "Arc Testnet Connected"
    : connected
      ? t("wrongNetwork")
      : t("disconnected");

  return (
    <main className="min-h-full flex-1 bg-slate-50 px-4 py-8 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Dashboard header */}
        <div>
          <h1 className="text-3xl font-bold">
            {t("dashboard")}
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("paymentDescription")}
          </p>
        </div>

        {/* On-chain wallet balance */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Wallet size={18} />
              {t("connectedWallet")}
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
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

          <div className="mt-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("usdcBalance")}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="break-all text-3xl font-bold">
                {wallet.loadingBalance
                  ? t("loading")
                  : balance}
              </h2>

              {ready && (
                <button
                  type="button"
                  disabled={wallet.loadingBalance}
                  onClick={() =>
                    void wallet.refreshBalance()
                  }
                  title={t("refresh")}
                  aria-label={t("refresh")}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <RefreshCw
                    size={17}
                    className={
                      wallet.loadingBalance
                        ? "animate-spin"
                        : ""
                    }
                  />
                </button>
              )}
            </div>

            {wallet.address && (
              <p className="mt-3 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                {wallet.address}
              </p>
            )}

            {!ready && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {language === "vi"
                  ? "Vui lòng kết nối ví trên Arc Testnet bằng nút ở góc trên bên phải."
                  : "Connect a wallet on Arc Testnet using the button in the top-right corner."}
              </p>
            )}
          </div>
        </section>

        {/* Dashboard tabs */}
        <div
          className="grid grid-cols-2 gap-3"
          role="tablist"
          aria-label={
            language === "vi"
              ? "Chức năng thanh toán"
              : "Payment sections"
          }
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "payments"}
            onClick={() =>
              setActiveTab("payments")
            }
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition sm:text-base ${
              activeTab === "payments"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Link2 size={18} />
            {t("paymentLinks")}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "transactions"}
            onClick={() =>
              setActiveTab("transactions")
            }
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition sm:text-base ${
              activeTab === "transactions"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <History size={18} />
            {t("transactions")}
          </button>
        </div>

        {/* Show only the active tab */}
        {activeTab === "payments" ? (
          <section
            role="tabpanel"
            className="space-y-6"
          >
            <PaymentLinksCard />
          </section>
        ) : (
          <section role="tabpanel">
            <TransactionHistory />
          </section>
        )}

        <p className="pb-6 text-center text-xs text-slate-400 dark:text-slate-500">
          FlowUSD · Arc Testnet ·{" "}
          {language === "vi"
            ? "Thanh toán USDC trên blockchain"
            : "On-chain USDC Payments"}
        </p>
      </div>
    </main>
  );
}
