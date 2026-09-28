import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const transaction = db.transactions.find((tx) => tx.id === id);

  if (!transaction) {
    return NextResponse.json(
      { message: "Transaction not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(transaction);
}
