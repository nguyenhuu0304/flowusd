"use client";

import { useEffect } from "react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { BATCH_CONTRACT_ADDRESS } from "@/lib/web3/batchPaymentLinks";

type CloudMember = {
  id: string;
  name: string;
  raw: string;
  status: "pending" | "unpaid" | "paid";
  payer?: string;
  directoryId?: string | null;
};

type CloudBill = {
  id: string;
  creator: string;
  title: string;
  createdAt: string;
  totalRaw: string;
  members: CloudMember[];
  txHash: string;
  stage:
    | "prepared"
    | "submitted"
    | "confirmed"
    | "needs_review";
};

const API_BASE = (
  process.env.NEXT_PUBLIC_FLOWUSD_BOT_API_URL || ""
).replace(/\/$/, "");

const SYNC_INTERVAL_MS = 8000;

function storageKey(owner: string): string {
  return (
    "flowusd:batch-bills:v1:" +
    BATCH_CONTRACT_ADDRESS.toLowerCase() +
    ":" +
    owner.toLowerCase()
  );
}

function syncedKey(
  owner: string,
  billId: string
): string {
  return (
    "flowusd:cloud-bill-synced:v1:" +
    owner.toLowerCase() +
    ":" +
    billId.toLowerCase()
  );
}

function reloadKey(owner: string): string {
  return (
    "flowusd:cloud-reload:v1:" +
    owner.toLowerCase()
  );
}

function readLocalBills(
  owner: string
): CloudBill[] {
  try {
    const raw = localStorage.getItem(
      storageKey(owner)
    );

    const parsed: unknown = JSON.parse(
      raw || "[]"
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is CloudBill =>
        !!value &&
        typeof value === "object" &&
        typeof value.id === "string" &&
        typeof value.creator === "string" &&
        value.creator.toLowerCase() ===
          owner.toLowerCase() &&
        Array.isArray(value.members)
    );
  } catch {
    return [];
  }
}

function sortBills(
  bills: CloudBill[]
): CloudBill[] {
  return [...bills].sort((a, b) => {
    const left = Date.parse(a.createdAt || "");
    const right = Date.parse(b.createdAt || "");

    return (
      (Number.isFinite(right) ? right : 0) -
      (Number.isFinite(left) ? left : 0)
    );
  });
}

function mergeBills(
  localBills: CloudBill[],
  cloudBills: CloudBill[]
): CloudBill[] {
  const merged =
    new Map<string, CloudBill>();

  for (const bill of localBills) {
    merged.set(
      bill.id.toLowerCase(),
      bill
    );
  }

  for (const cloud of cloudBills) {
    const key =
      cloud.id.toLowerCase();

    const local =
      merged.get(key);

    if (!local) {
      merged.set(key, cloud);
      continue;
    }

    const localMembers =
      new Map(
        local.members.map(member => [
          member.id.toLowerCase(),
          member,
        ])
      );

    merged.set(key, {
      ...local,
      ...cloud,

      // Preserve a nicer local title if an older
      // cloud copy did not contain one.
      title:
        cloud.title ||
        local.title,

      createdAt:
        cloud.createdAt ||
        local.createdAt,

      members:
        cloud.members.map(
          cloudMember => {
            const localMember =
              localMembers.get(
                cloudMember.id.toLowerCase()
              );

            return {
              ...localMember,
              ...cloudMember,

              name:
                cloudMember.name ||
                localMember?.name ||
                "Member",

              directoryId:
                cloudMember.directoryId ??
                localMember?.directoryId ??
                null,
            };
          }
        ),
    });
  }

  return sortBills(
    Array.from(
      merged.values()
    )
  );
}

function fingerprint(
  bill: CloudBill
): string {
  return JSON.stringify({
    id: bill.id,
    creator: bill.creator,
    title: bill.title,
    createdAt: bill.createdAt,
    totalRaw: bill.totalRaw,
    txHash: bill.txHash,
    stage: bill.stage,
    members: bill.members.map(
      member => ({
        id: member.id,
        name: member.name,
        raw: member.raw,
        status: member.status,
        payer: member.payer || "",
        directoryId:
          member.directoryId || null,
      })
    ),
  });
}

async function pushConfirmedBills(
  owner: string
): Promise<void> {
  const bills =
    readLocalBills(owner);

  for (const bill of bills) {
    if (
      bill.stage !== "confirmed" ||
      !/^0x[a-fA-F0-9]{64}$/.test(
        bill.txHash
      )
    ) {
      continue;
    }

    const mark =
      fingerprint(bill);

    if (
      localStorage.getItem(
        syncedKey(
          owner,
          bill.id
        )
      ) === mark
    ) {
      continue;
    }

    const response =
      await fetch(
        `${API_BASE}/api/cloud-bills`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(bill),
        }
      );

    if (!response.ok) {
      const detail =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        typeof detail.detail === "string"
          ? detail.detail
          : `Cloud bill sync HTTP ${response.status}`
      );
    }

    localStorage.setItem(
      syncedKey(
        owner,
        bill.id
      ),
      mark
    );
  }
}

async function pullCloudBills(
  owner: string
): Promise<boolean> {
  const response =
    await fetch(
      `${API_BASE}/api/cloud-bills/${owner}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Cloud bill load HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const cloudBills:
    CloudBill[] =
      Array.isArray(data.bills)
        ? data.bills
        : [];

  const localBills =
    readLocalBills(owner);

  const merged =
    mergeBills(
      localBills,
      cloudBills
    );

  const before =
    JSON.stringify(
      sortBills(localBills)
    );

  const after =
    JSON.stringify(merged);

  if (before === after) {
    return false;
  }

  localStorage.setItem(
    storageKey(owner),
    after
  );

  return true;
}

export default function BillCloudBridge() {
  const wallet =
    useWeb3Wallet();

  const owner =
    wallet.address;

  useEffect(() => {
    if (
      !owner ||
      !API_BASE ||
      !BATCH_CONTRACT_ADDRESS
    ) {
      return;
    }

    let active = true;
    let running = false;

    async function synchronize() {
      if (
        !active ||
        running
      ) {
        return;
      }

      running = true;

      try {
        await pushConfirmedBills(
          owner!
        );

        const changed =
          await pullCloudBills(
            owner!
          );

        if (
          active &&
          changed
        ) {
          const bills =
            readLocalBills(
              owner!
            );

          const signature =
            JSON.stringify(
              bills.map(
                bill => [
                  bill.id,
                  bill.stage,
                  bill.txHash,
                  ...bill.members.map(
                    member =>
                      `${member.id}:${member.status}:${member.payer || ""}`
                  ),
                ]
              )
            );

          const key =
            reloadKey(
              owner!
            );

          if (
            sessionStorage.getItem(
              key
            ) !== signature
          ) {
            sessionStorage.setItem(
              key,
              signature
            );

            window.setTimeout(
              () => {
                if (active) {
                  window.location.reload();
                }
              },
              150
            );
          }
        }
      } catch (error) {
        // Cloud sync is an enhancement. Never block
        // the on-chain payment flow if Render is
        // waking up or temporarily unavailable.
        console.warn(
          "[bill-cloud-sync]",
          error instanceof Error
            ? error.message
            : String(error)
        );
      } finally {
        running = false;
      }
    }

    void synchronize();

    const timer =
      window.setInterval(
        () => {
          void synchronize();
        },
        SYNC_INTERVAL_MS
      );

    return () => {
      active = false;
      window.clearInterval(
        timer
      );
    };
  }, [owner]);

  return null;
}
