
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe2,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Wallet,
  X,
} from "lucide-react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { useAppearance } from "@/contexts/AppearanceContext";
import { explorerAddressUrl } from "@/lib/web3/config";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Topbar() {
  const wallet = useWeb3Wallet();

  const {
    theme,
    language,
    setTheme,
    setLanguage,
    t,
  } = useAppearance();

  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const connected = Boolean(
    wallet.address && wallet.provider
  );

  const onArc =
    connected && wallet.isOnArcTestnet;

  async function connectWallet() {
    setError("");

    try {
      await wallet.connect();
      setMenuOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not connect wallet."
      );
    }
  }

  async function connectWithWallet(
    option: (typeof wallet.wallets)[number]
  ) {
    setError("");

    try {
      await wallet.connectWith(option);
      setMenuOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not connect wallet."
      );
    }
  }

  async function copyAddress() {
    if (!wallet.address) return;

    try {
      await navigator.clipboard.writeText(
        wallet.address
      );

      setCopied(true);
    } catch {
      setError(
        language === "vi"
          ? "Không thể sao chép địa chỉ ví."
          : "Could not copy wallet address."
      );
    }
  }

  function disconnectWallet() {
    wallet.disconnect();
    setMenuOpen(false);
    setError("");
    setCopied(false);
  }

  function toggleTheme() {
    setTheme(
      theme === "light" ? "dark" : "light"
    );
  }

  function toggleLanguage() {
    setLanguage(
      language === "en" ? "vi" : "en"
    );
  }

  return (
    <header className="relative z-30 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6 lg:px-8">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="min-w-0"
      >
        <h1 className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
          FlowUSD
        </h1>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          USDC Payments on Arc
        </p>
      </Link>

      {/* Topbar Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Network */}
        <span className="hidden rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300 md:inline-flex">
          Arc Testnet
        </span>

        {/* Theme */}
        <button
          type="button"
          onClick={toggleTheme}
          title={
            theme === "light"
              ? t("dark")
              : t("light")
          }
          aria-label={
            theme === "light"
              ? t("dark")
              : t("light")
          }
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {theme === "light" ? (
            <Moon size={19} />
          ) : (
            <Sun size={19} />
          )}
        </button>

        {/* Language */}
        <button
          type="button"
          onClick={toggleLanguage}
          title={t("language")}
          aria-label={t("language")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Globe2 size={17} />
          {language.toUpperCase()}
        </button>

        {/* Wallet */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((previous) => !previous);
              setError("");
              setCopied(false);
            }}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition sm:px-4 ${
              onArc
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : connected
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
            }`}
            aria-expanded={menuOpen}
            aria-label={t("connectWallet")}
          >
            {onArc ? (
              <CheckCircle2 size={17} />
            ) : (
              <Wallet size={17} />
            )}

            <span>
              {wallet.address
                ? shortAddress(wallet.address)
                : t("connectWallet")}
            </span>

            <ChevronDown size={15} />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close wallet menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default bg-transparent"
              />

              <div className="absolute right-0 top-full z-50 mt-3 w-[min(350px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold">
                    {connected
                      ? t("connectedWallet")
                      : t("connectWallet")}
                  </h2>

                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {connected && wallet.address ? (
                  <div className="space-y-4">
                    {/* Address */}
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                        {t("walletAddress")}
                      </p>

                      <p className="break-all font-mono text-xs">
                        {wallet.address}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          onArc
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {onArc
                          ? `Arc Testnet · ${t("connected")}`
                          : t("wrongNetwork")}
                      </span>

                      <button
                        type="button"
                        onClick={copyAddress}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <Copy size={13} />
                        {copied
                          ? t("copied")
                          : t("copyAddress")}
                      </button>
                    </div>

                    {/* Balance */}
                    {onArc && (
                      <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("usdcBalance")}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="break-all text-lg font-bold">
                            {wallet.loadingBalance
                              ? t("loading")
                              : wallet.balance !== null
                                ? `${wallet.balance} USDC`
                                : "— USDC"}
                          </p>

                          <button
                            type="button"
                            disabled={wallet.loadingBalance}
                            onClick={() => {
                              void wallet.refreshBalance();
                            }}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900"
                            title={t("refresh")}
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
                        </div>
                      </div>
                    )}

                    {!onArc && (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {language === "vi"
                          ? "Vui lòng chuyển ví sang Arc Testnet (Chain ID 5042002)."
                          : "Please switch your wallet to Arc Testnet (Chain ID 5042002)."}
                      </p>
                    )}

                    <a
                      href={explorerAddressUrl(
                        wallet.address
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      <ExternalLink size={16} />
                      {t("viewExplorer")}
                    </a>

                    <button
                      type="button"
                      onClick={disconnectWallet}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <LogOut size={16} />
                      {t("disconnectWallet")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {language === "vi"
                        ? "Chọn ví để kết nối FlowUSD trên Arc Testnet."
                        : "Select a browser wallet to use FlowUSD on Arc Testnet."}
                    </p>

                    {!wallet.discoveryDone ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("loading")}
                      </p>
                    ) : wallet.wallets.length === 0 ? (
                      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {language === "vi"
                          ? "Không tìm thấy ví trình duyệt tương thích."
                          : "No compatible browser wallet was found."}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {wallet.wallets.map((option) => (
                          <button
                            type="button"
                            key={option.uuid}
                            disabled={wallet.connecting}
                            onClick={() => {
                              void connectWithWallet(
                                option
                              );
                            }}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-slate-800"
                          >
                            <Wallet size={17} />
                            {option.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {wallet.wallets.length === 1 && (
                      <button
                        type="button"
                        disabled={wallet.connecting}
                        onClick={() => {
                          void connectWallet();
                        }}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {wallet.connecting
                          ? t("loading")
                          : t("connectWallet")}
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-4 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
                  >
                    {error}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
