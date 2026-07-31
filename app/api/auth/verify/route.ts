import { NextRequest, NextResponse } from "next/server";
import { getDb, type StoredUser } from "@/lib/server/db";
import { publicUser, fakeToken } from "@/lib/server/auth";

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, code } = body ?? {};

  if (!email || !code) {
    return NextResponse.json(
      { message: "Email and code are required." },
      { status: 400 }
    );
  }

  const db = getDb();
  const normalizedEmail = String(email).toLowerCase();
  const pending = db.pendingRegistrations.get(normalizedEmail);

  if (!pending) {
    return NextResponse.json(
      {
        message:
          "No pending registration found for this email. Please register again.",
      },
      { status: 404 }
    );
  }

  if (Date.now() > pending.expiresAt) {
    db.pendingRegistrations.delete(normalizedEmail);

    return NextResponse.json(
      { message: "This code has expired. Please request a new one." },
      { status: 410 }
    );
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    db.pendingRegistrations.delete(normalizedEmail);

    return NextResponse.json(
      { message: "Too many incorrect attempts. Please register again." },
      { status: 429 }
    );
  }

  if (String(code) !== pending.code) {
    pending.attempts += 1;

    return NextResponse.json(
      {
        message: `Incorrect code. ${MAX_ATTEMPTS - pending.attempts} attempt(s) left.`,
      },
      { status: 400 }
    );
  }

  const user: StoredUser = {
    id: `user_${Date.now()}`,
    name: pending.name,
    email: pending.email,
    password: pending.password, // demo-only in-memory store: never do this in a real backend
  };

  db.users.push(user);
  db.pendingRegistrations.delete(normalizedEmail);

  return NextResponse.json(
    { user: publicUser(user), token: fakeToken(user.id) },
    { status: 201 }
  );
}
