"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { Copy, QrCode, Wallet } from "lucide-react";

export default function WalletCard() {
  const { wallet } = useWallet();

  async function copyAddress() {
    await navigator.clipboard.writeText(wallet.address);
    alert("Wallet address copied!");
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
        {/* Wallet Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <Wallet size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                My Wallet
              </h2>

              <p className="text-slate-500">
                Connected to {wallet.network}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-500">
              Available Balance
            </p>

            <h3 className="mt-2 text-5xl font-bold text-slate-900">
              {wallet.balance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}

              <span className="ml-3 text-2xl text-blue-600">
                {wallet.currency}
              </span>
            </h3>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-500">
              Wallet Address
            </p>

            <div className="mt-2 flex items-center gap-3">
              <code className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm">
                {wallet.address}
              </code>

              <Button
                variant="outline"
                onClick={copyAddress}
                className="px-4"
              >
                <Copy size={18} />
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700">
              ● Connected
            </span>
          </div>
        </div>

        {/* QR Placeholder */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-56 w-56 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-100">
            <QrCode
              size={80}
              className="text-slate-400"
            />
          </div>

          <p className="mt-4 text-sm text-slate-500">
            QR Code (Coming Soon)
          </p>
        </div>
      </div>
    </Card>
  );
}