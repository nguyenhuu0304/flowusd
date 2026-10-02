"use client";

export const TELEGRAM_API_BASE = (
  process.env.NEXT_PUBLIC_FLOWUSD_BOT_API_URL || ""
).replace(/\/$/, "");

export type DirectoryContact = {
  id: string;
  display_name: string;
  full_name: string;
  username: string | null;
};

export type LinkedMember = {
  id: string;
  name: string;
  raw: string;
  directoryId?: string | null;
};

export type LinkedBill = {
  id: string;
  title: string;
  creator: string;
  totalRaw: string;
  txHash: string;
  stage: string;
  members: LinkedMember[];
};

const SESS_PREFIX = "flowusd:telegram-session:v3:";
const LEGACY_SESS_PREFIX = "flowusd:telegram-session:v2:";

export const DIRECTORY_CHANGED_EVENT =
  "flowusd:directory-changed";

type StoredSession = {
  token: string;
};

type LegacyStoredSession = {
  token: string;
  expires: number;
};

function keyFor(owner: string): string {
  return SESS_PREFIX + owner.toLowerCase();
}

function legacyKeyFor(owner: string): string {
  return LEGACY_SESS_PREFIX + owner.toLowerCase();
}

export function getTelegramToken(
  owner: string | null | undefined
): string {
  if (!owner || typeof window === "undefined") {
    return "";
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem(keyFor(owner)) || "null"
    ) as StoredSession | null;

    if (saved?.token) {
      return saved.token;
    }

    // One-time migration from the previous sessionStorage-based
    // implementation. A still-valid legacy token is copied into
    // localStorage. The backend may still require one Renew action
    // if that old token has already expired.
    const legacy = JSON.parse(
      sessionStorage.getItem(
        legacyKeyFor(owner)
      ) || "null"
    ) as LegacyStoredSession | null;

    if (
      legacy?.token &&
      legacy.expires > Date.now() + 2500
    ) {
      localStorage.setItem(
        keyFor(owner),
        JSON.stringify({
          token: legacy.token,
        })
      );

      return legacy.token;
    }

    return "";
  } catch {
    return "";
  }
}

export function saveTelegramToken(
  owner: string,
  token: string,
  _expiresIn?: number
): void {
  if (
    typeof window === "undefined" ||
    !owner ||
    !token
  ) {
    return;
  }

  localStorage.setItem(
    keyFor(owner),
    JSON.stringify({
      token,
    })
  );

  // Remove the old browser-session copy after migration.
  sessionStorage.removeItem(
    legacyKeyFor(owner)
  );
}

export function clearTelegramToken(
  owner: string
): void {
  if (
    typeof window === "undefined" ||
    !owner
  ) {
    return;
  }

  localStorage.removeItem(
    keyFor(owner)
  );

  sessionStorage.removeItem(
    legacyKeyFor(owner)
  );
}

export async function telegramApi(
  path: string,
  method: "GET" | "POST" | "PATCH",
  data?: unknown,
  token?: string
) {
  if (!TELEGRAM_API_BASE) {
    throw new Error(
      "Configure NEXT_PUBLIC_FLOWUSD_BOT_API_URL first."
    );
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE}${path}`,
    {
      method,
      cache: "no-store",
      headers: {
        ...(data !== undefined
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },
      ...(data !== undefined
        ? {
            body: JSON.stringify(data),
          }
        : {}),
    }
  );

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : `Telegram API HTTP ${response.status}`
    );
  }

  return result;
}

export async function getContacts(
  owner: string
): Promise<DirectoryContact[]> {
  const token =
    getTelegramToken(owner);

  if (!token) {
    return [];
  }

  const data = await telegramApi(
    "/api/directory",
    "GET",
    undefined,
    token
  );

  return Array.isArray(data.members)
    ? (data.members as DirectoryContact[])
    : [];
}

export async function syncBill(
  owner: string,
  bill: LinkedBill
) {
  if (
    bill.stage !== "confirmed" ||
    !/^0x[0-9a-f]{64}$/i.test(
      bill.txHash
    )
  ) {
    throw new Error(
      "Bill not confirmed on-chain."
    );
  }

  const token =
    getTelegramToken(owner);

  if (!token) {
    throw new Error(
      "Telegram owner session is not connected. Use /connect or Renew wallet session."
    );
  }

  return telegramApi(
    "/api/bills",
    "POST",
    {
      id: bill.id,
      creator: owner,
      title: bill.title,
      totalRaw: bill.totalRaw,
      txHash: bill.txHash,
      members: bill.members.map(
        member => ({
          id: member.id,
          name:
            member.name.trim() ||
            "Member",
          raw: member.raw,
          directoryId:
            member.directoryId ||
            null,
        })
      ),
    },
    token
  );
}
