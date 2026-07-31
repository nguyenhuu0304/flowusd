"use client";

import { FormEvent, useState } from "react";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { useWallet } from "@/hooks/useWallet";
import { depositLending, withdrawLending } from "@/services/wallet.service";
import { formatCurrency } from "@/lib/format";

export default function LendingCard() {
  const { wallet, loading, refetch } = useWallet();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  async function handleDeposit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDepositing(true);

    try {
      await depositLending(Number(depositAmount));
      toast.success(`Deposited ${depositAmount} USDC to earn.`);
      setDepositAmount("");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Deposit failed.";
      toast.error(message);
    } finally {
      setDepositing(false);
    }
  }

  async function handleWithdraw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWithdrawing(true);

    try {
      const amount = withdrawAmount ? Number(withdrawAmount) : undefined;
      await withdrawLending(amount);
      toast.success("Withdrawn from your earning balance.");
      setWithdrawAmount("");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Withdrawal failed.";
      toast.error(message);
    } finally {
      setWithdrawing(false);
    }
  }

  const lending = wallet?.lending;
  const projectedAnnual = lending
    ? Math.round(lending.deposited * (lending.apy / 100) * 100) / 100
    : 0;

  return (
    <Card className="p-8">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-900">Earn (Lending)</h2>
      </div>

      <p className="mb-6 text-sm text-slate-500">
        Deposit USDC to earn a simulated fixed APY. Part of the App Wallet
        (Demo) — not a real lending market.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">Deposited</p>
          <h3 className="mt-1 text-xl font-bold text-emerald-900">
            {loading ? "..." : formatCurrency(lending?.deposited ?? 0)} USDC
          </h3>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">Accrued Interest</p>
          <h3 className="mt-1 text-xl font-bold text-emerald-900">
            {loading ? "..." : formatCurrency(lending?.accruedInterest ?? 0)}{" "}
            USDC
          </h3>
        </div>

        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-sm text-slate-500">APY</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            {lending?.apy ?? 0}%
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            ≈ {formatCurrency(projectedAnnual)} USDC/yr projected
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <form onSubmit={handleDeposit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Deposit
          </label>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount in USDC"
            required
          />

          <Button
            type="submit"
            disabled={depositing}
            className="w-full justify-center"
          >
            {depositing ? "Depositing..." : "Deposit"}
          </Button>
        </form>

        <form onSubmit={handleWithdraw} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Withdraw{" "}
            <span className="font-normal text-slate-400">
              (leave blank for all)
            </span>
          </label>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount in USDC"
          />

          <Button
            type="submit"
            variant="outline"
            disabled={withdrawing || !lending?.deposited}
            className="w-full justify-center"
          >
            {withdrawing ? "Withdrawing..." : "Withdraw"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
