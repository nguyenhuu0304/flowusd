// Sends the registration verification code by email via Resend
// (https://resend.com). Requires a RESEND_API_KEY environment variable.
//
// If RESEND_API_KEY isn't set (e.g. local dev with no email provider
// configured yet), we don't fail registration — we just log the code to
// the server console instead, so the flow can still be tested end to end
// without setting anything up.

const RESEND_API_URL = "https://api.resend.com/emails";

function emailHtml(name: string, code: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#2563eb;">FlowUSD</h2>
      <p>Hi ${name},</p>
      <p>Use the code below to verify your email and finish creating your account:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background:#f1f5f9; border-radius: 12px;">
        ${code}
      </p>
      <p style="color:#64748b; font-size: 14px;">
        This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // No email provider configured — fall back to logging so local dev
    // and demo deployments without RESEND_API_KEY still work end to end.
    console.log(
      `[email] RESEND_API_KEY not set — verification code for ${to}: ${code}`
    );
    return;
  }

  const from = process.env.EMAIL_FROM ?? "FlowUSD <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your FlowUSD verification code",
      html: emailHtml(name, code),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[email] Resend request failed:", res.status, detail);
    throw new Error("Could not send verification email. Please try again.");
  }
}

export function generateVerificationCode(): string {
  // 6-digit numeric code, zero-padded.
  return Math.floor(100000 + Math.random() * 900000).toString();
}
