import { NextRequest, NextResponse } from "next/server";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/server/email";
import { decodePendingToken, encodePendingToken } from "@/lib/server/pendingToken";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, pendingToken } = body ?? {};

  if (!email || !pendingToken) {
    return NextResponse.json(
      { message: "Email and pendingToken are required." },
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

  if (pending.email.toLowerCase() !== String(email).toLowerCase()) {
    return NextResponse.json(
      { message: "This code was issued for a different email address." },
      { status: 400 }
    );
  }

  const code = generateVerificationCode();

  const newPendingToken = encodePendingToken({
    ...pending,
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
  });

  try {
    await sendVerificationEmail(pending.email, pending.name, code);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send verification email.";

    return NextResponse.json({ message }, { status: 502 });
  }

  return NextResponse.json({ success: true, pendingToken: newPendingToken });
}
