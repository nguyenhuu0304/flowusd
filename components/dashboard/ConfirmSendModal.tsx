"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import {
  CURRENCY,
  NETWORK_NAME,
} from "@/lib/constants";

type Props = {
  open: boolean;
  recipient: string;
  amount: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmSendModal({
  open,
  recipient,
  amount,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  const shortAddress =
    recipient.length > 18
      ? `${recipient.slice(0, 10)}...${recipient.slice(-8)}`
      : recipient;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg p-8">
        <h2 className="text-2xl font-bold text-slate-900">
          Confirm Transaction
        </h2>

        <p className="mt-2 text-slate-500">
          Please review the transaction before sending.
        </p>

        <div className="mt-8 space-y-5">
          <Row
            label="Recipient"
            value={shortAddress}
          />

          <Row
            label="Amount"
            value={`${Number(amount).toFixed(2)} ${CURRENCY}`}
          />

          <Row
            label="Network"
            value={NETWORK_NAME}
          />

          <Row
            label="Fee"
            value={`0.00 ${CURRENCY}`}
          />
        </div>

        <div className="mt-10 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : `Confirm ${CURRENCY}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

type RowProps = {
  label: string;
  value: string;
};

function Row({
  label,
  value,
}: RowProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}