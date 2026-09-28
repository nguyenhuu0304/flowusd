import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/server/email";
import { encodePendingToken } from "@/lib/server/pendingToken";

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

  // Encrypted into the token instead of an in-memory Map, so this works
  // the same whether /verify happens to land on this exact server
  // instance or a different one (see lib/server/pendingToken.ts).
  const pendingToken = encodePendingToken({
    name,
    email,
    password,
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  try {
    await sendVerificationEmail(email, name, code);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send verification email.";

    return NextResponse.json({ message }, { status: 502 });
  }

  return NextResponse.json(
    { pendingEmail: email, pendingToken },
    { status: 200 }
  );
}
