"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, QrCode, Share2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { useWallet } from "@/hooks/useWallet";

import {
  COPY_SUCCESS_DURATION,
  CURRENCY,
  NETWORK_NAME,
} from "@/lib/constants";

import { formatCurrency } from "@/lib/format";

import { copyToClipboard } from "@/lib/utils";

export default function ReceiveCard() {
  const { wallet } = useWallet();

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(wallet.address);

      setCopied(true);

      toast.success("Wallet address copied!", {
        description: "You can now paste it anywhere.",
      });

      setTimeout(() => {
        setCopied(false);
      }, COPY_SUCCESS_DURATION);
    } catch {
      toast.error("Failed to copy address.");
    }
  }

  function handleShare() {
    toast.info("Share feature", {
      description: "Sharing wallet address will be available soon.",
    });
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">
            Receive {CURRENCY}
          </h2>

          <p className="mt-2 text-slate-500">
            Share your wallet address or QR code to receive payments.
          </p>

          <div className="mt-8">
            <p className="text-sm text-slate-500">
              Wallet Address
            </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <code className="break-all text-sm text-slate-800">
                {wallet.address}
              </code>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Button
              onClick={handleCopy}
              className="justify-center"
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

            <Button
              variant="outline"
              onClick={handleShare}
              className="justify-center"
            >
              <Share2 size={18} />
              <span>Share</span>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">
                Network
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {NETWORK_NAME}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Balance
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {formatCurrency(wallet.balance)} {CURRENCY}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex h-64 w-64 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-100">
            <QrCode
              size={96}
              className="text-slate-400"
            />
          </div>

          <p className="mt-4 text-sm text-slate-500">
            QR Code will be generated here.
          </p>
        </div>
      </div>
    </Card>
  );
}