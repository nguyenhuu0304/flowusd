"use client";

import { useState } from "react";
import { Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { getTransactionById } from "@/services/transaction.service";

import {
  COPY_SUCCESS_DURATION,
  CURRENCY,
  EXPLORER_URL,
  NETWORK_NAME,
} from "@/lib/constants";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

import { copyToClipboard } from "@/lib/utils";

type Props = {
  id: string;
};

export default function TransactionDetail({ id }: Props) {
  const tx = getTransactionById(id);

  const [copied, setCopied] = useState(false);

  if (!tx) {
    return (
      <Card className="p-8">
        <p className="text-center text-slate-500">
          Transaction not found.
        </p>
      </Card>
    );
  }

  async function handleCopy() {
    try {
      await copyToClipboard(tx.id);

      setCopied(true);

      toast.success("Transaction ID copied.");

      setTimeout(() => {
        setCopied(false);
      }, COPY_SUCCESS_DURATION);
    } catch {
      toast.error("Failed to copy transaction ID.");
    }
  }

  function handleExplorer() {
    window.open(
      `${EXPLORER_URL}/tx/${tx.id}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Card className="p-8">
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Transaction Information
          </h2>

          <p className="mt-2 text-slate-500">
            Complete information for this transaction.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Info
            label="Transaction ID"
            value={tx.id}
          />

          <Info
            label="Amount"
            value={`${formatCurrency(
              Math.abs(tx.amount)
            )} ${CURRENCY}`}
          />

          <Info
            label="From"
            value="My Wallet"
          />

          <Info
            label="To"
            value={tx.address}
          />

          <Info
            label="Network"
            value={NETWORK_NAME}
          />

          <Info
            label="Created At"
            value={formatDate(tx.createdAt)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-500">
            Status
          </p>

          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              tx.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            <CheckCircle2 size={16} />

            {tx.status === "completed"
              ? "Completed"
              : "Pending"}
          </span>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button onClick={handleCopy}>
            <Copy size={18} />

            <span>
              {copied
                ? "Copied!"
                : "Copy Transaction ID"}
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExplorer}
          >
            <ExternalLink size={18} />

            <span>Open Explorer</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

type InfoProps = {
  label: string;
  value: string;
};

function Info({
  label,
  value,
}: InfoProps) {
  return (
    <div>
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}