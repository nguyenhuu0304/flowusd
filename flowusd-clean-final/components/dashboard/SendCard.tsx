"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SendHorizontal } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import ConfirmSendModal from "@/components/dashboard/ConfirmSendModal";
import TransactionSuccess from "@/components/dashboard/TransactionSuccess";

import { useWallet } from "@/hooks/useWallet";
import { useTransactions } from "@/hooks/useTransactions";
import { sendMoney } from "@/services/wallet.service";

import { CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export default function SendCard() {
  const router = useRouter();
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();
  const { refetch: refetchTransactions } = useTransactions();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const [loading, setLoading] = useState(false);
  const [sentTransactionId, setSentTransactionId] = useState<string | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);

  function handleOpenConfirm(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!wallet) {
      toast.error("Wallet not loaded.");
      return;
    }

    const value = Number(amount);

    if (value <= 0) {
      toast.error("Invalid amount.");
      return;
    }

    if (value > wallet.balance) {
      toast.error("Insufficient balance.");
      return;
    }

    setOpenConfirm(true);
  }

  async function handleConfirm() {
    setOpenConfirm(false);

    setLoading(true);

    try {
      const result = await sendMoney({
        recipient,
        amount: Number(amount),
        memo: memo || undefined,
      });

      toast.success("Transaction submitted successfully.");

      setRecipient("");
      setAmount("");
      setMemo("");
      setSentTransactionId(result.transaction.id);

      await Promise.all([refetchWallet(), refetchTransactions()]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not send the transaction.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (sentTransactionId) {
    return (
      <TransactionSuccess
        hash={sentTransactionId}
        onView={() => router.push(`/transactions/${sentTransactionId}`)}
      />
    );
  }

  return (
    <>
      <Card className="p-8">
        <form
          onSubmit={handleOpenConfirm}
          className="space-y-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Recipient Address
            </label>

            <Input
              type="text"
              value={recipient}
              onChange={(e) =>
                setRecipient(e.target.value)
              }
              placeholder="0x..."
              required
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Amount ({CURRENCY})
              </label>

              {!walletLoading && wallet && (
                <span className="text-sm text-slate-500">
                  Available:{" "}
                  {formatCurrency(wallet.balance)}{" "}
                  {CURRENCY}
                </span>
              )}
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
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
              onChange={(e) =>
                setMemo(e.target.value)
              }
              placeholder="Payment for invoice..."
            />
          </div>

          <Button
            type="submit"
            disabled={loading || walletLoading}
            className="w-full justify-center"
          >
            <SendHorizontal size={18} />

            <span>
              {loading
                ? "Sending..."
                : `Send ${CURRENCY}`}
            </span>
          </Button>
        </form>
      </Card>

      <ConfirmSendModal
        open={openConfirm}
        recipient={recipient}
        amount={amount}
        loading={loading}
        onCancel={() => setOpenConfirm(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}