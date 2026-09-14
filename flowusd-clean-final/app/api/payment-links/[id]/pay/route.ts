import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredTransaction } from "@/lib/server/db";
import { serializeWallet } from "@/lib/server/finance";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const { amount, payerName } = body ?? {};

  const db = getDb();

  const link = db.paymentLinks.find((l) => l.id === id);

  if (!link) {
    return NextResponse.json(
      { message: "Payment link not found." },
      { status: 404 }
    );
  }

  if (link.status === "paid") {
    return NextResponse.json(
      { message: "This payment link has already been paid." },
      { status: 409 }
    );
  }

  // Fixed-amount links always charge the amount set at creation. Open
  // links ("any amount") require the payer to specify how much.
  let value: number;

  if (link.amount !== null) {
    value = link.amount;
  } else {
    value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { message: "Amount must be a positive number." },
        { status: 400 }
      );
    }

    value = Math.round(value * 1e6) / 1e6;
  }

  if (payerName !== undefined && typeof payerName !== "string") {
    return NextResponse.json(
      { message: "Payer name must be text." },
      { status: 400 }
    );
  }

  const displayName = (payerName || "").trim() || "Payment link";

  db.wallet.balance = Math.round((db.wallet.balance + value) * 100) / 100;

  const transaction: StoredTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: displayName,
    address: link.id,
    amount: value,
    type: "income",
    status: "completed",
    createdAt: new Date().toISOString(),
    ...(link.memo ? { memo: link.memo } : {}),
  };

  db.transactions.unshift(transaction);

  link.status = "paid";
  link.paidAt = transaction.createdAt;
  if (payerName) link.payerName = displayName;

  return NextResponse.json({
    wallet: serializeWallet(db.wallet),
    transaction,
    paymentLink: link,
  });
}
