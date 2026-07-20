"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

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

          <Input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Amount ({CURRENCY})
          </label>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Memo (Optional)
          </label>

          <Textarea
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Payment for invoice..."
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