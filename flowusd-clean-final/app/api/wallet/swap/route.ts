import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import {
  convert,
  getCurrencyBalance,
  isSupportedCurrency,
  serializeWallet,
  setCurrencyBalance,
} from "@/lib/server/finance";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { from, to, amount } = body ?? {};

  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
    return NextResponse.json(
      { message: "Unsupported currency." },
      { status: 400 }
    );
  }

  if (from === to) {
    return NextResponse.json(
      { message: "Choose two different currencies." },
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
  const wallet = db.wallet;

  const fromBalance = getCurrencyBalance(wallet, from);

  if (value > fromBalance) {
    return NextResponse.json(
      { message: `Insufficient ${from} balance.` },
      { status: 400 }
    );
  }

  const received = convert(value, from, to);
  const toBalance = getCurrencyBalance(wallet, to);

  setCurrencyBalance(wallet, from, fromBalance - value);
  setCurrencyBalance(wallet, to, toBalance + received);

  return NextResponse.json({
    wallet: serializeWallet(wallet),
    received,
  });
}
