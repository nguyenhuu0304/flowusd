"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Wallet2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { getPaymentLink, payPaymentLink, PaymentLinkApi } from "@/lib/api/payment-links";
import { CURRENCY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

type LoadState = "loading" | "not-found" | "ready";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [state, setState] = useState<LoadState>("loading");
  const [link, setLink] = useState<PaymentLinkApi | null>(null);

  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paying, setPaying] = useState(false);
  const [paidTransactionId, setPaidTransactionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getPaymentLink(id);
        if (active) {
          setLink(data);
          setState("ready");
        }
      } catch {
        if (active) setState("not-found");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!link) return;

    setPaying(true);

    try {
      const result = await payPaymentLink(id, {
        amount: link.amount === null ? Number(amount) : undefined,
        payerName: payerName.trim() || undefined,
      });

      setLink(result.paymentLink);
      setPaidTransactionId(result.transaction.id);

      toast.success("Payment sent!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Payment failed. Please try again.";
      toast.error(message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-blue-600">FlowUSD</h1>
          <p className="mt-1 text-sm text-slate-500">Open-source payments on Arc</p>
        </div>

        {state === "loading" && (
          <Card className="p-8 text-center text-slate-500">Loading payment request...</Card>
        )}

        {state === "not-found" && (
          <Card className="p-8 text-center">
            <p className="font-semibold text-slate-900">Payment link not found</p>
            <p className="mt-2 text-sm text-slate-500">
              This link may have been mistyped, or no longer exists.
            </p>
          </Card>
        )}

        {state === "ready" && link && (
          <Card className="p-8">
            {link.status === "paid" ? (
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500" />

                <h2 className="mt-4 text-xl font-bold text-slate-900">
                  {paidTransactionId ? "Payment successful!" : "This request has been paid"}
                </h2>

                <p className="mt-2 text-slate-500">
                  {link.amount !== null
                    ? `${formatCurrency(link.amount)} ${CURRENCY}`
                    : "Payment"}{" "}
                  {link.paidAt ? `on ${formatDate(link.paidAt)}` : ""}
                </p>

                {link.memo && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {link.memo}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <Wallet2 size={32} className="mx-auto text-blue-600" />

                  <p className="mt-3 text-sm text-slate-500">Payment request</p>

                  <h2 className="mt-1 text-3xl font-bold text-slate-900">
                    {link.amount !== null
                      ? `${formatCurrency(link.amount)} ${CURRENCY}`
                      : "Choose amount"}
                  </h2>

                  {link.memo && <p className="mt-3 text-slate-600">{link.memo}</p>}
                </div>

                <form onSubmit={handlePay} className="space-y-4">
                  {link.amount === null && (
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
                        placeholder="1.0"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Your name — optional
                    </label>

                    <Input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>

                  <Button type="submit" disabled={paying} className="w-full justify-center">
                    {paying ? "Processing..." : "Pay"}
                  </Button>

                  <p className="text-center text-xs text-slate-400">
                    Demo payment — this simulates a transfer inside FlowUSD, no
                    real funds move.
                  </p>
                </form>
              </>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
