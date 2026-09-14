import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredPaymentLink } from "@/lib/server/db";

export async function GET() {
  const db = getDb();

  // Newest first.
  const links = [...db.paymentLinks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(links);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { amount, memo } = body ?? {};

  let normalizedAmount: number | null = null;

  // amount is optional: omit it (or pass null) to create an "any amount"
  // request where the payer types in how much to send.
  if (amount !== undefined && amount !== null && amount !== "") {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { message: "Amount must be a positive number, or left empty." },
        { status: 400 }
      );
    }

    normalizedAmount = Math.round(value * 1e6) / 1e6;
  }

  if (memo !== undefined && typeof memo !== "string") {
    return NextResponse.json(
      { message: "Memo must be text." },
      { status: 400 }
    );
  }

  const db = getDb();

  const link: StoredPaymentLink = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount: normalizedAmount,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...(memo ? { memo } : {}),
  };

  db.paymentLinks.unshift(link);

  return NextResponse.json(link, { status: 201 });
}
