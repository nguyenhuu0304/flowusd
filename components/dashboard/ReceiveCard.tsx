"use client";

import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Share2,
} from "lucide-react";

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
  const { wallet, loading } = useWallet();

  const qrRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState(false);

  if (loading || !wallet) {
    return (
      <Card className="p-8">
        <div className="animate-pulse flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-5">
            <div className="h-8 w-48 rounded bg-slate-200" />
            <div className="h-4 w-72 rounded bg-slate-200" />
            <div className="h-20 w-full rounded-xl bg-slate-200" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-11 rounded-xl bg-slate-200" />
              <div className="h-11 rounded-xl bg-slate-200" />
            </div>
            <div className="h-11 rounded-xl bg-slate-200" />
          </div>

          <div className="flex items-center justify-center">
            <div className="h-64 w-64 rounded-3xl bg-slate-200" />
          </div>
        </div>
      </Card>
    );
  }

  async function handleCopy() {
    if (!wallet) return;

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

  async function handleDownload() {
    if (!wallet || !qrRef.current) return;

    try {
      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        pixelRatio: 3,
      });

      const link = document.createElement("a");

      link.download = "flowusd-wallet-qr.png";
      link.href = dataUrl;

      link.click();

      toast.success("QR Code downloaded!");
    } catch {
      toast.error("Failed to download QR Code.");
    }
  }

  function handleShare() {
    toast.info("Share feature", {
      description:
        "Sharing wallet address will be available soon.",
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
            Share your wallet address or QR code to receive
            payments.
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

          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="w-full justify-center"
            >
              <Download size={18} />
              <span>Download QR</span>
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
          <div
            ref={qrRef}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <QRCode
              value={wallet.address}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
            />
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Scan this QR code to receive {CURRENCY}.
          </p>
        </div>
      </div>
    </Card>
  );
}