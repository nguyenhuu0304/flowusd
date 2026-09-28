import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { serializeWallet, settleLendingInterest } from "@/lib/server/finance";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const db = getDb();
  const wallet = db.wallet;

  // Settle accrued interest into the main balance and reset the clock
  // before touching the deposited principal.
  settleLendingInterest(wallet);

  const requested =
    body?.amount !== undefined ? Number(body.amount) : wallet.lending.deposited;

  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json(
      { message: "Amount must be a positive number." },
      { status: 400 }
    );
  }

  if (requested > wallet.lending.deposited) {
    return NextResponse.json(
      { message: "Amount exceeds your deposited balance." },
      { status: 400 }
    );
  }

  wallet.lending.deposited = Math.round(
    (wallet.lending.deposited - requested) * 100
  ) / 100;
  wallet.balance = Math.round((wallet.balance + requested) * 100) / 100;
  wallet.lending.since = wallet.lending.deposited > 0 ? new Date().toISOString() : null;

  return NextResponse.json({ wallet: serializeWallet(wallet) });
}
