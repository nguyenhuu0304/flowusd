"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { getTransactionById } from "@/services/transaction.service";

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
    await navigator.clipboard.writeText(tx.id);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function handleExplorer() {
    window.open(
      `https://explorer.example.com/tx/${tx.id}`,
      "_blank"
    );
  }

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(tx.amount));

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
            value={`${formattedAmount} USDC`}
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
            value="Arc Mainnet"
          />

          <Info
            label="Created At"
            value={tx.createdAt}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-500">
            Status
          </p>

          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
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

function Info({ label, value }: InfoProps) {
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