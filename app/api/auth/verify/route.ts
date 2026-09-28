import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredUser } from "@/lib/server/db";
import { publicUser, fakeToken } from "@/lib/server/auth";
import { decodePendingToken } from "@/lib/server/pendingToken";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, code, pendingToken } = body ?? {};

  if (!email || !code || !pendingToken) {
    return NextResponse.json(
      { message: "Email, code and pendingToken are required." },
      { status: 400 }
    );
  }

  const pending = decodePendingToken(pendingToken);

  if (!pending) {
    return NextResponse.json(
      {
        message:
          "This verification link is invalid. Please register again.",
      },
      { status: 404 }
    );
  }

  const normalizedEmail = String(email).toLowerCase();

  if (pending.email.toLowerCase() !== normalizedEmail) {
    return NextResponse.json(
      { message: "This code was issued for a different email address." },
      { status: 400 }
    );
  }

  if (Date.now() > pending.expiresAt) {
    return NextResponse.json(
      { message: "This code has expired. Please request a new one." },
      { status: 410 }
    );
  }

  if (String(code) !== pending.code) {
    return NextResponse.json(
      { message: "Incorrect code. Please try again." },
      { status: 400 }
    );
  }

  const db = getDb();

  // Someone could in principle submit the same still-valid token twice —
  // guard against creating a duplicate account.
  const alreadyExists = db.users.some(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (alreadyExists) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const user: StoredUser = {
    id: `user_${Date.now()}`,
    name: pending.name,
    email: pending.email,
    password: pending.password, // demo-only in-memory store: never do this in a real backend
  };

  db.users.push(user);

  return NextResponse.json(
    { user: publicUser(user), token: fakeToken(user.id) },
    { status: 201 }
  );
}
