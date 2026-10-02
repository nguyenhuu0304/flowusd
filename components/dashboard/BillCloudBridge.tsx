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
    "flowusd:cloud-bill-synced:v2:" +
    owner.toLowerCase() +
    ":" +
    billId.toLowerCase()
  );
}

function reloadKey(owner: string): string {
  return (
    "flowusd:cloud-reload:v2:" +
    owner.toLowerCase()
  );
}

function isMember(
  value: unknown
): value is CloudMember {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const member =
    value as Partial<CloudMember>;

  return (
    typeof member.id === "string" &&
    /^0x[a-fA-F0-9]{64}$/.test(
      member.id
    ) &&
    typeof member.name === "string" &&
    typeof member.raw === "string" &&
    /^\d+$/.test(member.raw) &&
    (
      member.status === "pending" ||
      member.status === "unpaid" ||
      member.status === "paid"
    )
  );
}

function isBill(
  value: unknown,
  owner: string
): value is CloudBill {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const bill =
    value as Partial<CloudBill>;

  return (
    typeof bill.id === "string" &&
    typeof bill.creator === "string" &&
    bill.creator.toLowerCase() ===
      owner.toLowerCase() &&
    typeof bill.title === "string" &&
    typeof bill.createdAt === "string" &&
    !Number.isNaN(
      Date.parse(bill.createdAt)
    ) &&
    typeof bill.totalRaw === "string" &&
    /^\d+$/.test(bill.totalRaw) &&
    typeof bill.txHash === "string" &&
    /^0x[a-fA-F0-9]{64}$/.test(
      bill.txHash
    ) &&
    (
      bill.stage === "prepared" ||
      bill.stage === "submitted" ||
      bill.stage === "confirmed" ||
      bill.stage === "needs_review"
    ) &&
    Array.isArray(bill.members) &&
    bill.members.length > 0 &&
    bill.members.every(isMember)
  );
}

function readLocalBills(
  owner: string
): CloudBill[] {
  try {
    const raw =
      localStorage.getItem(
        storageKey(owner)
      );

    const parsed: unknown =
      JSON.parse(raw || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    const valid =
      parsed.filter(
        (value): value is CloudBill =>
          isBill(
            value,
            owner
          )
      );

    // Self-heal old or malformed browser data so
    // Bill History can never crash on stale records.
    if (
      valid.length !==
      parsed.length
    ) {
      localStorage.setItem(
        storageKey(owner),
        JSON.stringify(valid)
      );
    }

    return valid;
  } catch {
    localStorage.removeItem(
      storageKey(owner)
    );

    return [];
  }
}

function sortBills(
  bills: CloudBill[]
): CloudBill[] {
  return [...bills].sort(
    (a, b) =>
      Date.parse(b.createdAt) -
      Date.parse(a.createdAt)
  );
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
      merged.set(
        key,
        cloud
      );
      continue;
    }

    const localMembers =
      new Map(
        local.members.map(
          member => [
            member.id.toLowerCase(),
            member,
          ]
        )
      );

    merged.set(key, {
      ...local,
      ...cloud,
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
    members:
      bill.members.map(
        member => ({
          id: member.id,
          name: member.name,
          raw: member.raw,
          status: member.status,
          payer:
            member.payer || "",
          directoryId:
            member.directoryId ||
            null,
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
      bill.stage !==
        "confirmed" ||
      !/^0x[a-fA-F0-9]{64}$/.test(
        bill.txHash
      )
    ) {
      continue;
    }

    const mark =
      fingerprint(bill);

    const key =
      syncedKey(
        owner,
        bill.id
      );

    if (
      localStorage.getItem(
        key
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
          body:
            JSON.stringify(
              bill
            ),
        }
      );

    if (!response.ok) {
      const detail =
        await response
          .json()
          .catch(
            () => ({})
          );

      throw new Error(
        typeof detail.detail ===
          "string"
          ? detail.detail
          : `Cloud bill sync HTTP ${response.status}`
      );
    }

    localStorage.setItem(
      key,
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

  const data: unknown =
    await response.json();

  const rawBills =
    (
      data &&
      typeof data === "object" &&
      Array.isArray(
        (
          data as {
            bills?: unknown;
          }
        ).bills
      )
    )
      ? (
          data as {
            bills: unknown[];
          }
        ).bills
      : [];

  const cloudBills =
    rawBills.filter(
      (value): value is CloudBill =>
        isBill(
          value,
          owner
        )
    );

  const localBills =
    readLocalBills(owner);

  const merged =
    mergeBills(
      localBills,
      cloudBills
    );

  const before =
    JSON.stringify(
      sortBills(
        localBills
      )
    );

  const after =
    JSON.stringify(
      merged
    );

  if (
    before === after
  ) {
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
