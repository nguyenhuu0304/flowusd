"use client";

import Link from "next/link";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/format";
import { CURRENCY, NETWORK_NAME } from "@/lib/constants";

function comingSoon(feature: string) {
  toast.info("Coming soon", {
    description: `${feature} isn't available yet.`,
  });
}

export default function BalanceCard() {
  const { wallet, loading } = useWallet();

  if (loading || !wallet) {
    return (
      <Card className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 rounded bg-slate-200" />

          <div className="h-12 w-80 rounded bg-slate-200" />

          <div className="h-6 w-52 rounded bg-slate-200" />

          <div className="grid grid-cols-2 gap-4 lg:w-96">
            <div className="h-12 rounded-xl bg-slate-200" />
            <div className="h-12 rounded-xl bg-slate-200" />
            <div className="h-12 rounded-xl bg-slate-200" />
            <div className="h-12 rounded-xl bg-slate-200" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Total Balance
          </p>

          <h2 className="mt-2 text-5xl font-bold tracking-tight text-slate-900">
            {formatCurrency(wallet.balance)}

            <span className="ml-3 text-2xl font-semibold text-blue-600">
              {CURRENCY}
            </span>
          </h2>

        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/send"
            className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
          >
            Send
          </Link>

          <Link
            href="/receive"
            className="rounded-xl border border-slate-300 px-6 py-3 text-center font-semibold transition hover:bg-slate-50"
          >
            Receive
          </Link>

          <button
            onClick={() => comingSoon("Deposit")}
            className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-50"
          >
            Deposit
          </button>

          <button
            onClick={() => comingSoon("Withdraw")}
            className="rounded-xl border border-slate-300 px-6 py-3 font-semibold transition hover:bg-slate-50"
          >
            Withdraw
          </button>
        </div>
      </div>

      <div className="mt-8 border-t pt-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">
              Wallet Address
            </p>

            <p className="mt-2 font-mono text-sm text-slate-900">
              {wallet.address}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Network
            </p>

            <p className="mt-2 font-semibold text-slate-900">
              {NETWORK_NAME}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Status
            </p>

            <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              Connected
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}