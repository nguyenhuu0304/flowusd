"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { CURRENCY } from "@/lib/constants";
import { sleep } from "@/lib/utils";

export default function SendCard() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setSuccess(false);

    await sleep(1200);

    console.log({
      recipient,
      amount,
      memo,
    });

    setLoading(false);
    setSuccess(true);

    setRecipient("");
    setAmount("");
    setMemo("");
  }

  return (
    <Card className="p-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Recipient Address
          </label>

          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Amount ({CURRENCY})
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Memo (Optional)
          </label>

          <textarea
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Payment for invoice..."
            className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600"
          />
        </div>

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✅ Transaction submitted successfully (mock).
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full justify-center"
        >
          <SendHorizontal size={18} />

          <span>
            {loading ? "Sending..." : `Send ${CURRENCY}`}
          </span>
        </Button>
      </form>
    </Card>
  );
}