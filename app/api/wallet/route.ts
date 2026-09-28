import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { serializeWallet } from "@/lib/server/finance";

export async function GET() {
  const db = getDb();
  return NextResponse.json(serializeWallet(db.wallet));
}
