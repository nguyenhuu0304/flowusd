import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { publicUser, fakeToken } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  const db = getDb();

  const user = db.users.find(
    (u) => u.email.toLowerCase() === String(email ?? "").toLowerCase()
  );

  if (!user || user.password !== password) {
    return NextResponse.json(
      { message: "Invalid email or password." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: publicUser(user),
    token: fakeToken(user.id),
  });
}
