"use client";

export const TELEGRAM_API_BASE = (process.env.NEXT_PUBLIC_FLOWUSD_BOT_API_URL || "").replace(/\/$/, "");
export type DirectoryContact = { id: string; display_name: string; full_name: string; username: string | null };
export type LinkedMember = { id: string; name: string; raw: string; directoryId?: string | null };
export type LinkedBill = { id: string; title: string; creator: string; totalRaw: string; txHash: string; stage: string; members: LinkedMember[] };
const SESS_PREFIX = "flowusd:telegram-session:v2:";
export const DIRECTORY_CHANGED_EVENT = "flowusd:directory-changed";

export function getTelegramToken(owner: string | null | undefined): string {
  if (!owner || typeof window === "undefined") return "";
  try {
    const item = JSON.parse(sessionStorage.getItem(SESS_PREFIX + owner.toLowerCase()) || "null") as { token: string; expires: number } | null;
    if (!item || !item.token || item.expires <= Date.now() + 2500) return "";
    return item.token;
  } catch { return ""; }
}
export function saveTelegramToken(owner: string, token: string, expiresIn: number) {
  sessionStorage.setItem(SESS_PREFIX + owner.toLowerCase(), JSON.stringify({ token, expires: Date.now() + Math.min(600, Number(expiresIn) || 600) * 1000 }));
}
export function clearTelegramToken(owner: string) {
  sessionStorage.removeItem(SESS_PREFIX + owner.toLowerCase());
}
export async function telegramApi(path: string, method: "GET" | "POST" | "PATCH", data?: unknown, token?: string) {
  if (!TELEGRAM_API_BASE) throw new Error("Configure NEXT_PUBLIC_FLOWUSD_BOT_API_URL first.");
  const response = await fetch(`${TELEGRAM_API_BASE}${path}`, {
    method, cache: "no-store", headers: {
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : `Telegram API HTTP ${response.status}`);
  return result;
}
export async function getContacts(owner: string): Promise<DirectoryContact[]> {
  const token = getTelegramToken(owner);
  if (!token) return [];
  const data = await telegramApi("/api/directory", "GET", undefined, token);
  return Array.isArray(data.members) ? data.members as DirectoryContact[] : [];
}
export async function syncBill(owner: string, bill: LinkedBill) {
  if (bill.stage !== "confirmed" || !/^0x[0-9a-f]{64}$/i.test(bill.txHash)) throw new Error("Bill not confirmed on-chain.");
  const token = getTelegramToken(owner);
  if (!token) throw new Error("Telegram owner session expired. Use /connect, then Sync All.");
  return telegramApi("/api/bills", "POST", {
    id: bill.id, creator: owner, title: bill.title, totalRaw: bill.totalRaw, txHash: bill.txHash,
    members: bill.members.map(m => ({ id: m.id, name: m.name.trim() || "Member", raw: m.raw, directoryId: m.directoryId || null })),
  }, token);
}
