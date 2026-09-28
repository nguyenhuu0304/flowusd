"use client";

import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { copyToClipboard } from "@/lib/utils";

type Props = {
  hash: string;
  onView: () => void;
};

export default function TransactionSuccess({
  hash,
  onView,
}: Props) {
  async function handleCopy() {
    try {
      await copyToClipboard(hash);

      toast.success("Transaction hash copied!");
    } catch {
      toast.error("Failed to copy hash.");
    }
  }

  return (
    <Card className="p-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={42} />
        </div>

        <h2 className="mt-6 text-3xl font-bold text-slate-900">
          Transaction Sent
        </h2>

        <p className="mt-3 max-w-md text-slate-500">
          Your transaction has been submitted successfully.
          You can copy the transaction hash or view its details.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            Transaction Hash
          </p>

          <code className="mt-2 block break-all font-mono text-sm text-slate-900">
            {hash}
          </code>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button onClick={handleCopy}>
            <Copy size={18} />
            <span>Copy Hash</span>
          </Button>

          <Button
            variant="outline"
            onClick={onView}
          >
            <ExternalLink size={18} />
            <span>View Transaction</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}