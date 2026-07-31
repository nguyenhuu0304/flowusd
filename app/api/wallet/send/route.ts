import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredTransaction } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { recipient, amount, memo } = body ?? {};

  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    return NextResponse.json(
      { message: "Recipient address is required." },
      { status: 400 }
    );
  }

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json(
      { message: "Amount must be a positive number." },
      { status: 400 }
    );
  }

  const db = getDb();

  if (value > db.wallet.balance) {
    return NextResponse.json(
      { message: "Insufficient balance." },
      { status: 400 }
    );
  }

  db.wallet.balance = Math.round((db.wallet.balance - value) * 100) / 100;

  const transaction: StoredTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name:
      recipient.length > 20
        ? `${recipient.slice(0, 10)}...${recipient.slice(-6)}`
        : recipient,
    address: recipient,
    amount: -value,
    type: "expense",
    status: "completed",
    createdAt: new Date().toISOString(),
    ...(memo ? { memo } : {}),
  };

  db.transactions.unshift(transaction);

  return NextResponse.json({ wallet: db.wallet, transaction });
}
