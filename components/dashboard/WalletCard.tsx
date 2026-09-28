"use client";

import { useState } from "react";
import {
  Wallet,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import { useWallet } from "@/hooks/useWallet";

import {
  CURRENCY,
  COPY_SUCCESS_DURATION,
} from "@/lib/constants";

import {
  formatCurrency,
} from "@/lib/format";

import {
  copyToClipboard,
} from "@/lib/utils";

export default function WalletCard() {
  const { wallet, loading } = useWallet();

  const [copied, setCopied] = useState(false);

  if (loading || !wallet) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-32 rounded bg-slate-200" />
        </div>
      </Card>
    );
  }

  // Sau đoạn này wallet chắc chắn không còn null
  const currentWallet = wallet;

  async function handleCopy() {
    try {
      await copyToClipboard(currentWallet.address);

      setCopied(true);

      toast.success("Wallet address copied!");

      setTimeout(() => {
        setCopied(false);
      }, COPY_SUCCESS_DURATION);
    } catch {
      toast.error("Failed to copy wallet address.");
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Wallet className="text-blue-600" size={24} />

        <div>
          <h2 className="text-lg font-semibold">
            My Wallet
          </h2>

          <p className="text-sm text-slate-500">
            Current Balance
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-3xl font-bold">
          {formatCurrency(currentWallet.balance)} {CURRENCY}
        </p>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm text-slate-500">
          Wallet Address
        </p>

        <div className="break-all rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {currentWallet.address}
        </div>
      </div>

      <Button
        onClick={handleCopy}
        className="mt-6 w-full justify-center"
      >
        {copied ? (
          <>
            <Check size={18} />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy size={18} />
            <span>Copy Address</span>
          </>
        )}
      </Button>
    </Card>
  );
}