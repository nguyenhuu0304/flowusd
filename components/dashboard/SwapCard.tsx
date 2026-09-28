"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { useWallet } from "@/hooks/useWallet";
import { swapCurrency } from "@/services/wallet.service";
import { formatCurrency } from "@/lib/format";

const CURRENCIES = ["USDC", "EURC", "USDT"] as const;

// Fixed demo rates (units of currency per 1 USDC) — mirrors the ones
// used server-side, just for showing a live preview before submitting.
const RATE_PER_USDC: Record<(typeof CURRENCIES)[number], number> = {
  USDC: 1,
  EURC: 0.92,
  USDT: 1,
};

function getBalance(
  wallet: { currency: string; balance: number; balances: Record<string, number> } | null,
  currency: string
) {
  if (!wallet) return 0;
  return currency === wallet.currency ? wallet.balance : wallet.balances[currency] ?? 0;
}

export default function SwapCard() {
  const { wallet, loading, refetch } = useWallet();

  const [from, setFrom] = useState<(typeof CURRENCIES)[number]>("USDC");
  const [to, setTo] = useState<(typeof CURRENCIES)[number]>("EURC");
  const [amount, setAmount] = useState("");
  const [swapping, setSwapping] = useState(false);

  const estimatedReceived = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    const rate = RATE_PER_USDC[to] / RATE_PER_USDC[from];
    return Math.round(value * rate * 1e6) / 1e6;
  }, [amount, from, to]);

  function flip() {
    setFrom(to);
    setTo(from);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = Number(amount);

    if (from === to) {
      toast.error("Choose two different currencies.");
      return;
    }

    setSwapping(true);

    try {
      const result = await swapCurrency({ from, to, amount: value });
      toast.success(
        `Swapped ${value} ${from} for ${result.received} ${to}.`
      );
      setAmount("");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Swap failed.";
      toast.error(message);
    } finally {
      setSwapping(false);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Swap</h2>
        <p className="mt-2 text-sm text-slate-500">
          Convert between demo stablecoin balances instantly. Simulated
          exchange rates — part of the App Wallet (Demo), not real trading.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            From
          </label>

          <div className="flex gap-3">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value as (typeof CURRENCIES)[number])}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none focus:border-blue-600"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <Input
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Balance: {formatCurrency(getBalance(wallet, from))} {from}
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={flip}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            title="Flip currencies"
          >
            <ArrowDownUp size={18} />
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            To (estimated)
          </label>

          <div className="flex gap-3">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as (typeof CURRENCIES)[number])}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none focus:border-blue-600"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700">
              {estimatedReceived || "0.00"}
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Balance: {formatCurrency(getBalance(wallet, to))} {to}
          </p>
        </div>

        <Button
          type="submit"
          disabled={swapping || loading || from === to}
          className="w-full justify-center"
        >
          {swapping ? "Swapping..." : "Swap"}
        </Button>
      </form>
    </Card>
  );
}
