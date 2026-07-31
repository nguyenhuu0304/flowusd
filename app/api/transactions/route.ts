import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET() {
  const db = getDb();

  const sorted = [...db.transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(sorted);
}
