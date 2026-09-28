import crypto from "crypto";

// Demo-only secret. Overridable via env var for anyone deploying this
// "for real" — but a working default means the app still runs with zero
// configuration, matching the rest of this project's setup story.
const SECRET =
  process.env.AUTH_TOKEN_SECRET || "flowusd-demo-insecure-default-secret";

const KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes for AES-256

export type PendingRegistrationPayload = {
  name: string;
  email: string;
  password: string;
  code: string;
  expiresAt: number;
};

/**
 * Encrypts the pending-registration data into a single opaque string the
 * client round-trips back on /verify and /resend-code.
 *
 * Why not just keep it in server memory (a Map), like before? Because on
 * serverless platforms (Vercel, etc.) there's no guarantee two requests
 * from the same browser session hit the same running instance — a Map
 * populated during POST /register can simply not exist anymore by the
 * time POST /verify runs. Encoding the (encrypted) state into a token the
 * client already has to hold onto sidesteps that entirely: any instance
 * can verify any token, because the token *is* the state, not a pointer
 * to state stored elsewhere.
 */
export function encodePendingToken(payload: PendingRegistrationPayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);

  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(json, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

/**
 * Decrypts and validates a token produced by encodePendingToken. Returns
 * null for anything malformed, tampered with, or signed under a
 * different secret — callers should treat that the same as "not found".
 */
export function decodePendingToken(
  token: unknown
): PendingRegistrationPayload | null {
  if (typeof token !== "string" || !token) return null;

  try {
    const buf = Buffer.from(token, "base64url");

    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as PendingRegistrationPayload;
  } catch {
    // Wrong secret, corrupted/edited token, or not our token at all.
    return null;
  }
}
