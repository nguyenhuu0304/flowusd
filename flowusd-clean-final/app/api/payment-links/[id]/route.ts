import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = getDb();

  const link = db.paymentLinks.find((l) => l.id === id);

  if (!link) {
    return NextResponse.json(
      { message: "Payment link not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(link);
}
