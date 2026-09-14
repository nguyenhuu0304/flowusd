import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/server/email";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email } = body ?? {};

  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
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

  const code = generateVerificationCode();
  pending.code = code;
  pending.expiresAt = Date.now() + CODE_TTL_MS;
  pending.attempts = 0;

  try {
    await sendVerificationEmail(pending.email, pending.name, code);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send verification email.";

    return NextResponse.json({ message }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
