import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/server/email";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, password, confirmPassword } = body ?? {};

  if (!name || !email || !password || !confirmPassword) {
    return NextResponse.json(
      { message: "Name, email, password and confirm password are required." },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { message: "Passwords do not match." },
      { status: 400 }
    );
  }

  if (String(password).length < 6) {
    return NextResponse.json(
      { message: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const db = getDb();
  const normalizedEmail = String(email).toLowerCase();

  const exists = db.users.some((u) => u.email.toLowerCase() === normalizedEmail);

  if (exists) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const code = generateVerificationCode();

  db.pendingRegistrations.set(normalizedEmail, {
    name,
    email,
    password,
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });

  try {
    await sendVerificationEmail(email, name, code);
  } catch (error) {
    db.pendingRegistrations.delete(normalizedEmail);

    const message =
      error instanceof Error ? error.message : "Could not send verification email.";

    return NextResponse.json({ message }, { status: 502 });
  }

  return NextResponse.json(
    { pendingEmail: email },
    { status: 200 }
  );
}
