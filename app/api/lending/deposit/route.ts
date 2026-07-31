import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { serializeWallet, settleLendingInterest } from "@/lib/server/finance";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { amount } = body ?? {};

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json(
      { message: "Amount must be a positive number." },
      { status: 400 }
    );
  }

  const db = getDb();
  const wallet = db.wallet;

  if (value > wallet.balance) {
    return NextResponse.json(
      { message: "Insufficient USDC balance." },
      { status: 400 }
    );
  }

  // Pay out whatever interest has already accrued before changing the
  // deposited principal, then reset the accrual clock.
  settleLendingInterest(wallet);

  wallet.balance = Math.round((wallet.balance - value) * 100) / 100;
  wallet.lending.deposited = Math.round(
    (wallet.lending.deposited + value) * 100
  ) / 100;
  wallet.lending.since = new Date().toISOString();

  return NextResponse.json({ wallet: serializeWallet(wallet) });
}
