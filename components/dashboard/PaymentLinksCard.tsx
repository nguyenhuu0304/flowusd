"use client";

import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  QrCode,
} from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import StatusBadge from "@/components/ui/StatusBadge";

import { usePaymentLinks } from "@/hooks/usePaymentLinks";
import { PaymentLinkApi } from "@/lib/api/payment-links";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { copyToClipboard } from "@/lib/utils";

function getPublicUrl(id: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/pay/${id}`;
}

function CreatePaymentLinkForm({
  onCreated,
}: {
  onCreated: (link: PaymentLinkApi) => void;
}) {
  const { create, creating } = usePaymentLinks();

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const link = await create({
        amount: amount.trim() === "" ? null : Number(amount),
        memo: memo.trim() || undefined,
      });

      onCreated(link);
      setAmount("");
      setMemo("");

      toast.success("Payment link created!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create the link.";
      toast.error(message);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6 flex items-center gap-2">
        <Link2 size={20} className="text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">
          Create a Payment Link
        </h2>
      </div>

      <p className="mb-6 text-sm text-slate-500">
        Share a link or QR code so anyone can pay you — no wallet address
        needed on their end. Leave the amount empty to let the payer decide
        how much to send.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Amount ({CURRENCY}) — optional
          </label>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Leave empty for any amount"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Description — optional
          </label>

          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="What is this payment for?"
            rows={2}
          />
        </div>

        <Button type="submit" disabled={creating} className="w-full justify-center">
          {creating ? "Creating..." : "Create Link"}
        </Button>
      </form>
    </Card>
  );
}

function PaymentLinkRow({ link }: { link: PaymentLinkApi }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const url = getPublicUrl(link.id);

  async function handleCopy() {
    try {
      await copyToClipboard(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  async function handleDownloadQr() {
    if (!qrRef.current) return;

    try {
      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        pixelRatio: 3,
      });

      const a = document.createElement("a");
      a.download = `flowusd-payment-link-${link.id}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      toast.error("Failed to download QR Code.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {link.memo || "Payment request"}
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {link.amount !== null
              ? `${formatCurrency(link.amount)} ${CURRENCY}`
              : "Any amount"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Created {formatDate(link.createdAt)}
          </p>

          {link.status === "paid" && link.paidAt && (
            <p className="mt-1 text-sm text-emerald-600">
              Paid {formatDate(link.paidAt)}
              {link.payerName ? ` by ${link.payerName}` : ""}
            </p>
          )}
        </div>

        <StatusBadge status={link.status === "paid" ? "completed" : "pending"} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <code className="break-all text-xs text-slate-600">{url}</code>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleCopy} className="flex-1 justify-center">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? "Copied" : "Copy Link"}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowQr((v) => !v)}
          className="flex-1 justify-center"
        >
          <QrCode size={16} />
          <span>{showQr ? "Hide QR" : "Show QR"}</span>
        </Button>

        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" className="w-full justify-center">
            <ExternalLink size={16} />
            <span>Open</span>
          </Button>
        </a>
      </div>

      {showQr && (
        <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-5">
          <div
            ref={qrRef}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <QRCode value={url} size={180} bgColor="#ffffff" fgColor="#0f172a" level="M" />
          </div>

          <Button variant="outline" onClick={handleDownloadQr}>
            <Download size={16} />
            <span>Download QR</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PaymentLinksCard() {
  const { links, loading, refetch } = usePaymentLinks();

  return (
    <div className="space-y-8">
      <CreatePaymentLinkForm onCreated={() => refetch()} />

      <Card className="p-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          Your Payment Links
        </h2>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-slate-500">
            You haven&apos;t created any payment links yet.
          </p>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <PaymentLinkRow key={link.id} link={link} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
