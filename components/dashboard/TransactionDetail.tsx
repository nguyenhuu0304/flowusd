"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import { getTransaction } from "@/services/transaction.service";
import type { Transaction } from "@/types/transaction";

import {
  CURRENCY,
  NETWORK_NAME,
  COPY_SUCCESS_DURATION,
} from "@/lib/constants";

import { copyToClipboard } from "@/lib/utils";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

type Props = {
  id: string;
};

export default function TransactionDetail({
  id,
}: Props) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const data = await getTransaction(id);
        if (active) setTransaction(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

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
          Transaction not found.
        </p>
      </Card>
    );
  }

  const tx = transaction;

  async function handleCopy() {
    try {
      await copyToClipboard(tx.id);

      setCopied(true);

      toast.success("Transaction ID copied!");

      setTimeout(() => {
        setCopied(false);
      }, COPY_SUCCESS_DURATION);
    } catch {
      toast.error("Failed to copy transaction ID.");
    }
  }

  function handleExplorer() {
    window.open(
      `https://explorer.example.com/tx/${tx.id}`,
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
            value={
              tx.type === "expense"
                ? "My Wallet"
                : tx.address
            }
          />

          <Info
            label="To"
            value={
              tx.type === "expense"
                ? tx.address
                : "My Wallet"
            }
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

          {tx.status === "completed" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 size={16} />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700">
              <Clock3 size={16} />
              Pending
            </span>
          )}
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
