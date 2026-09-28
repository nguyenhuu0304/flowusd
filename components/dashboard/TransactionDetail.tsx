"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Copy, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCY, NETWORK_NAME, COPY_SUCCESS_DURATION } from "@/lib/constants";
import { copyToClipboard } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { explorerTxUrl } from "@/lib/web3/config";

type Props = { id: string };

export default function TransactionDetail({ id }: Props) {
  const { transactions, loading } = useTransactions();
  const [copied, setCopied] = useState(false);
  const decodedId = useMemo(() => decodeURIComponent(id), [id]);
  const transaction = transactions.find((tx) => tx.id === decodedId) ?? null;

  if (loading) {
    return (
      <Card className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-64 rounded bg-slate-200" />
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-200" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!transaction) {
    return (
      <Card className="p-8">
        <p className="text-center text-slate-500">
          Transaction not found. Connect the same Arc wallet used for this transaction and try again.
        </p>
      </Card>
    );
  }

  const tx = transaction;
  const hash = tx.hash ?? tx.id;
  const onChain = tx.source === "onchain" && hash.startsWith("0x");

  async function handleCopy() {
    try {
      await copyToClipboard(hash);
      setCopied(true);
      toast.success("Transaction hash copied!");
      setTimeout(() => setCopied(false), COPY_SUCCESS_DURATION);
    } catch {
      toast.error("Failed to copy transaction hash.");
    }
  }

  return (
    <Card className="p-8">
      <div className="space-y-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Transaction Information</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${onChain ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {onChain ? "On-chain" : "Demo"}
            </span>
          </div>
          <p className="mt-2 text-slate-500">Complete information for this transaction.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Info label={onChain ? "Transaction Hash" : "Transaction ID"} value={hash} />
          <Info label="Amount" value={`${formatCurrency(Math.abs(tx.amount))} ${CURRENCY}`} />
          <Info label="From" value={tx.type === "expense" ? "Connected Wallet" : tx.address} />
          <Info label="To" value={tx.type === "expense" ? tx.address : "Connected Wallet"} />
          <Info label="Network" value={NETWORK_NAME} />
          <Info label="Created At" value={formatDate(tx.createdAt)} />
          {tx.blockNumber !== undefined && <Info label="Block" value={String(tx.blockNumber)} />}
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-500">Status</p>
          {tx.status === "completed" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 size={16} /> Confirmed
            </span>
          ) : tx.status === "failed" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-700">
              <XCircle size={16} /> Failed
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700">
              <Clock3 size={16} /> Pending
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <Button onClick={handleCopy}>
            <Copy size={18} />
            <span>{copied ? "Copied!" : onChain ? "Copy Transaction Hash" : "Copy Transaction ID"}</span>
          </Button>

          {onChain && (
            <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink size={18} />
                <span>Open ArcScan</span>
              </Button>
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

type InfoProps = { label: string; value: string };

function Info({ label, value }: InfoProps) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium text-slate-900">{value}</p>
    </div>
  );
}
