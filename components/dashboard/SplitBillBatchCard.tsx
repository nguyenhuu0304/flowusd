"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Layers3,
  RefreshCcw,
} from "lucide-react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import TelegramSyncCard from "@/components/dashboard/TelegramSyncCard";
import BillHistoryPanel from "@/components/dashboard/BillHistoryPanel";

import {
  DIRECTORY_CHANGED_EVENT,
  getContacts,
  getTelegramToken,
  syncBill,
  type DirectoryContact,
} from "@/lib/telegramDirectory";

import { useAppearance } from "@/contexts/AppearanceContext";
import { generateOnChainLinkId } from "@/lib/web3/paymentLinksAbi";
import { formatUnits } from "@/lib/web3/erc20";

import {
  BATCH_CONTRACT_ADDRESS,
  batchIsConfigured,
  readBatchLink,
  submitBatch,
  waitForBatchReceipt,
} from "@/lib/web3/batchPaymentLinks";

import { explorerTxUrl } from "@/lib/web3/config";

type Member = {
  id: string;
  name: string;
  raw: string;
  status: "pending" | "unpaid" | "paid";
  payer?: string;
  directoryId?: string | null;
};

type BatchBill = {
  id: string;
  creator: string;
  title: string;
  createdAt: string;
  totalRaw: string;
  members: Member[];
  txHash: string;
  stage:
    | "prepared"
    | "submitted"
    | "confirmed"
    | "needs_review";
};

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

const ID_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const token = (amount: string) =>
  formatUnits(BigInt(amount), 6);

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const btn =
  "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600";

function parseTotal(value: string): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(
      "Invalid USDC amount; maximum 6 decimals."
    );
  }

  const [whole, fraction = ""] = trimmed.split(".");

  return (
    BigInt(whole) * 1_000_000n +
    BigInt(fraction.padEnd(6, "0") || "0")
  );
}

function storageKey(owner: string): string {
  return (
    "flowusd:batch-bills:v1:" +
    BATCH_CONTRACT_ADDRESS.toLowerCase() +
    ":" +
    owner.toLowerCase()
  );
}

function loadBills(owner: string): BatchBill[] {
  try {
    const raw = localStorage.getItem(storageKey(owner));
    const parsed: unknown = JSON.parse(raw || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is BatchBill =>
        !!value &&
        typeof value === "object" &&
        typeof value.creator === "string" &&
        value.creator.toLowerCase() === owner.toLowerCase() &&
        Array.isArray(value.members)
    );
  } catch {
    return [];
  }
}

function writeBills(
  owner: string,
  bills: BatchBill[]
): void {
  localStorage.setItem(
    storageKey(owner),
    JSON.stringify(bills)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isRateLimited(error: unknown): boolean {
  return /429|rate.limit|request exceeds|too many|limit exceeded|-32005/i.test(
    errorMessage(error)
  );
}

export default function SplitBillBatchCard() {
  const wallet = useWeb3Wallet();
  const { language } = useAppearance();

  const vi = language === "vi";
  const owner = wallet.address;
  const provider = wallet.provider;

  const ready =
    !!owner &&
    !!provider &&
    wallet.isOnArcTestnet &&
    batchIsConfigured();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState(1);
  const [aiCommand, setAiCommand] = useState("");

  const [names, setNames] = useState<string[]>([]);
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [bills, setBills] = useState<BatchBill[]>([]);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<"telegram" | "history" | "advanced">("telegram");
  // Per-bill verification feedback. Creation progress remains separate.
  const [verifyingBillId, setVerifyingBillId] = useState<string | null>(null);
  const [verificationMessages, setVerificationMessages] = useState<Record<string, string>>({});
  const [verifiedAt, setVerifiedAt] = useState<Record<string, string>>({});

  const busyRef = useRef(false);

  const groupSize = useMemo(() => {
    if (
      Number.isInteger(people) &&
      people >= 1 &&
      people <= 100
    ) {
      return people;
    }

    return 0;
  }, [people]);

  const validTotal = useMemo(() => {
    try {
      const raw = parseTotal(amount);

      return groupSize > 0 &&
        raw >= BigInt(groupSize)
        ? raw
        : null;
    } catch {
      return null;
    }
  }, [amount, groupSize]);

  useEffect(() => {
    setBills(owner ? loadBills(owner) : []);
    setProgress("");
    setVerifyingBillId(null);
    setVerificationMessages({});
    setVerifiedAt({});
    setChosenIds([]);
  }, [owner]);

  useEffect(() => {
    let live = true;

    const update = () => {
      if (!owner || !getTelegramToken(owner)) {
        if (live) setContacts([]);
        return;
      }

      void getContacts(owner)
        .then(items => {
          if (live) {
            setContacts(items);
          }
        })
        .catch(() => {
          if (live) {
            setContacts([]);
          }
        });
    };

    update();

    window.addEventListener(
      DIRECTORY_CHANGED_EVENT,
      update
    );

    return () => {
      live = false;

      window.removeEventListener(
        DIRECTORY_CHANGED_EVENT,
        update
      );
    };
  }, [owner]);

  function parseAiCommand() {
    const input = aiCommand.trim();

    if (!input) {
      toast.error(
        vi
          ? "Nhập lệnh trước, ví dụ: Tạo bill 10 USDC cho A, B, C."
          : "Enter a command first, for example: Create a 10 USDC bill for A, B, C."
      );
      return;
    }

    const normalized = input
      .replace(/\s+/g, " ")
      .trim();

    const amountMatch = normalized.match(
      /(\d+(?:[.,]\d{1,6})?)\s*(?:usdc|usd)\b/i
    );

    if (!amountMatch) {
      toast.error(
        vi
          ? "Không tìm thấy số tiền USDC trong lệnh."
          : "Could not find a USDC amount in the command."
      );
      return;
    }

    const parsedAmount = amountMatch[1].replace(",", ".");

    const explicitPeopleMatch =
      normalized.match(
        /(?:chia\s+cho|cho)\s+(\d{1,3})\s+(?:người|nguoi)\b/i
      ) ||
      normalized.match(
        /(?:for|between|among)\s+(\d{1,3})\s+(?:people|persons?)\b/i
      );

    let namesPart = "";

    const peopleNamesMatch =
      normalized.match(
        /(?:\d{1,3}\s+(?:người|nguoi))\s+(.+)$/i
      ) ||
      normalized.match(
        /(?:between|among)\s+(.+)$/i
      );

    if (peopleNamesMatch?.[1]) {
      namesPart = peopleNamesMatch[1];
    } else {
      const afterAmount = normalized.slice(
        (amountMatch.index || 0) + amountMatch[0].length
      );

      const recipientMatch =
        afterAmount.match(
          /(?:chia\s+cho|cho)\s+(.+)$/i
        ) ||
        afterAmount.match(
          /(?:for|to)\s+(.+)$/i
        );

      if (recipientMatch?.[1]) {
        namesPart = recipientMatch[1];
      }
    }

    namesPart = namesPart
      .replace(
        /^\d{1,3}\s+(?:người|nguoi|people|persons?)\s*/i,
        ""
      )
      .replace(/[.!?]+$/g, "")
      .trim();

    const parsedNames = namesPart
      ? namesPart
          .split(/\s*(?:,|;|\s+và\s+|\s+and\s+)\s*/i)
          .map(item => item.trim())
          .filter(Boolean)
      : [];

    const explicitPeople = explicitPeopleMatch
      ? Number(explicitPeopleMatch[1])
      : 0;

    const parsedPeople =
      explicitPeople ||
      parsedNames.length ||
      1;

    if (
      !Number.isInteger(parsedPeople) ||
      parsedPeople < 1 ||
      parsedPeople > 100
    ) {
      toast.error(
        vi
          ? "Số người phải từ 1 đến 100."
          : "People must be between 1 and 100."
      );
      return;
    }

    if (
      explicitPeople > 0 &&
      parsedNames.length > 0 &&
      explicitPeople !== parsedNames.length
    ) {
      toast.error(
        vi
          ? `Lệnh ghi ${explicitPeople} người nhưng tìm thấy ${parsedNames.length} tên.`
          : `The command says ${explicitPeople} people but ${parsedNames.length} names were found.`
      );
      return;
    }

    const titleMatch = normalized.match(
      /(?:tạo|tao|create)\s+(?:bill|hóa đơn|hoa don)\s+(.+?)\s+\d+(?:[.,]\d{1,6})?\s*(?:usdc|usd)\b/i
    );

    if (titleMatch?.[1]) {
      const parsedTitle = titleMatch[1]
        .replace(/^(?:chia|split)\s+/i, "")
        .trim();

      if (parsedTitle) {
        setTitle(parsedTitle.slice(0, 80));
      }
    }

    setAmount(parsedAmount);
    setPeople(parsedPeople);

    const nextNames = Array.from(
      { length: parsedPeople },
      (_, index) =>
        parsedNames[index] || ""
    );

    const nextChosenIds = nextNames.map(name => {
      const normalizedName =
        name.trim().toLocaleLowerCase();

      if (!normalizedName) {
        return "";
      }

      const matches = contacts.filter(
        contact =>
          contact.display_name.toLocaleLowerCase() ===
            normalizedName ||
          contact.full_name.toLocaleLowerCase() ===
            normalizedName ||
          (contact.username || "")
            .toLocaleLowerCase() ===
            normalizedName.replace(/^@/, "")
      );

      return matches.length === 1
        ? matches[0].id
        : "";
    });

    setNames(nextNames);
    setChosenIds(nextChosenIds);

    const linkedCount =
      nextChosenIds.filter(Boolean).length;

    toast.success(
      vi
        ? `Đã hiểu lệnh: ${parsedAmount} USDC · ${parsedPeople} người${
            linkedCount
              ? ` · ${linkedCount} Telegram`
              : ""
          }`
        : `Command parsed: ${parsedAmount} USDC · ${parsedPeople} people${
            linkedCount
              ? ` · ${linkedCount} Telegram`
              : ""
          }`
    );
  }

  function setName(index: number, value: string) {
    const normalized =
      value.trim().toLocaleLowerCase();

    const matches = normalized
      ? contacts.filter(
          contact =>
            contact.display_name.toLocaleLowerCase() ===
              normalized ||
            contact.full_name.toLocaleLowerCase() ===
              normalized ||
            (contact.username || "")
              .toLocaleLowerCase() ===
              normalized.replace(/^@/, "")
        )
      : [];

    setNames(old => {
      const next = [...old];
      next[index] = value;
      return next;
    });

    setChosenIds(old => {
      const next = [...old];

      next[index] =
        matches.length === 1
          ? matches[0].id
          : "";

      return next;
    });
  }

  function chooseName(index: number, id: string) {
    const match = contacts.find(c => c.id === id);

    setChosenIds(old => {
      const next = [...old];
      next[index] = id;
      return next;
    });

    if (match) {
      setNames(old => {
        const next = [...old];
        next[index] = match.display_name;
        return next;
      });
    }
  }

  const saveBill = useCallback(
    (address: string, bill: BatchBill) => {
      const next = loadBills(address).map(existing =>
        existing.id === bill.id
          ? bill
          : existing
      );

      if (!next.some(existing => existing.id === bill.id)) {
        next.unshift(bill);
      }

      writeBills(address, next);
      setBills(next);
    },
    []
  );

  const modifyMember = useCallback(
    (
      billId: string,
      memberId: string,
      patch: Partial<Member>
    ) => {
      if (!owner) return;

      const next = loadBills(owner).map(bill =>
        bill.id === billId
          ? {
              ...bill,
              members: bill.members.map(member =>
                member.id === memberId
                  ? { ...member, ...patch }
                  : member
              ),
            }
          : bill
      );

      writeBills(owner, next);
      setBills(next);
    },
    [owner]
  );

  function makeBill(address: string): BatchBill {
    if (validTotal === null || !groupSize) {
      throw new Error(
        "Enter a positive amount and 1-100 people."
      );
    }

    const base =
      validTotal / BigInt(groupSize);

    const extra = Number(
      validTotal % BigInt(groupSize)
    );

    const used = chosenIds
      .slice(0, groupSize)
      .filter(Boolean);

    if (used.length !== new Set(used).size) {
      throw new Error(
        "Each Telegram member can appear only once in a bill."
      );
    }

    const members: Member[] = Array.from(
      { length: groupSize },
      (_, index) => ({
        id: generateOnChainLinkId(),

        name:
          names[index]?.trim().slice(0, 60) ||
          (vi
            ? `Người ${index + 1}`
            : `Person ${index + 1}`),

        raw: (
          base +
          (index < extra ? 1n : 0n)
        ).toString(),

        status: "pending",
        directoryId:
          chosenIds[index] || null,
      })
    );

    return {
      id: generateOnChainLinkId(),
      creator: address,

      title:
        title.trim().slice(0, 80) ||
        (vi ? "Chia hóa đơn" : "Split bill"),

      createdAt: new Date().toISOString(),
      totalRaw: validTotal.toString(),
      members,
      stage: "prepared",
      txHash: "",
    };
  }

  async function createAll(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!owner) {
      toast.error(vi ? "Vui lòng kết nối ví chủ hóa đơn." : "Connect the bill owner wallet.");
      return;
    }

    if (!provider) {
      toast.error(vi ? "Không tìm thấy kết nối ví. Hãy kết nối lại." : "Wallet provider unavailable. Reconnect your wallet.");
      return;
    }

    if (!wallet.isOnArcTestnet) {
      toast.error(vi ? "Vui lòng chuyển ví sang Arc Testnet." : "Switch your wallet to Arc Testnet.");
      return;
    }

    if (!batchIsConfigured()) {
      toast.error(vi ? "Chưa cấu hình Batch Contract." : "Batch Contract is not configured.");
      return;
    }

    if (busyRef.current) {
      toast.info(vi ? "Đang có tác vụ blockchain khác chạy." : "Another blockchain operation is still running.");
      return;
    }

    busyRef.current = true;
    setBusy(true);

    let bill: BatchBill | null = null;

    try {
      bill = makeBill(owner);

      // Save IDs before asking for a wallet signature.
      // A retry must not silently create new IDs.
      saveBill(owner, bill);

      setProgress(
        vi
          ? "Đang chờ xác nhận Rabby..."
          : "Waiting for wallet confirmation..."
      );

      const hash = await submitBatch(
        provider,
        owner,
        bill.members.map(member => member.id),
        bill.members.map(member =>
          BigInt(member.raw)
        )
      );

      if (!ID_PATTERN.test(hash)) {
        throw new Error(
          "Wallet returned an invalid transaction hash."
        );
      }

      bill = {
        ...bill,
        txHash: hash,
        stage: "submitted",
      };

      saveBill(owner, bill);

      setProgress(
        vi
          ? "Đang chờ blockchain xác nhận..."
          : "Waiting for blockchain confirmation..."
      );

      await waitForBatchReceipt(
        provider,
        hash
      );

      bill = {
        ...bill,
        stage: "confirmed",

        members: bill.members.map(member => ({
          ...member,
          status: "unpaid" as const,
        })),
      };

      saveBill(owner, bill);

      toast.success(
        vi
          ? `Đã tạo ${bill.members.length} Payment Links!`
          : `${bill.members.length} payment links created!`
      );

      setTitle("");
      setAmount("");
      setNames([]);
      setChosenIds([]);

      if (getTelegramToken(owner)) {
        try {
          setProgress(
            "Syncing confirmed batch to Telegram..."
          );

          await syncBill(owner, bill);

          setProgress(
            "Telegram synced. Registered members will receive payment links."
          );

          toast.success(
            "Telegram sync completed"
          );
        } catch (syncError) {
          setProgress(
            "Blockchain confirmed. Telegram sync needs retry: " +
              errorMessage(syncError)
          );

          toast.error(
            "Links created, but Telegram sync failed. Use Sync All."
          );
        }
      } else {
        setProgress(
          "Links confirmed. Pair Telegram via /connect, then use Sync All."
        );
      }
    } catch (error) {
      if (bill) {
        saveBill(owner, {
          ...bill,

          stage: bill.txHash
            ? "submitted"
            : "needs_review",
        });
      }

      setProgress(
        vi
          ? "Đã lưu dữ liệu. Kiểm tra Explorer trước khi gửi lại giao dịch."
          : "Saved. Check Explorer before attempting another transaction."
      );

      toast.error(errorMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function reconcile(
    billId: string,
    verifyPaid = false
  ) {
    const note = (message: string) =>
      setVerificationMessages(previous => ({ ...previous, [billId]: message }));

    if (!owner || !provider || !wallet.isOnArcTestnet || !batchIsConfigured()) {
      const reason = !owner
        ? "Connect the original bill owner wallet."
        : !provider
          ? "Wallet provider unavailable. Reconnect your wallet."
          : !wallet.isOnArcTestnet
            ? "Switch the wallet to Arc Testnet."
            : "Batch Contract is not configured.";
      note(reason);
      toast.error(reason);
      return;
    }

    if (busyRef.current) {
      toast.info(vi ? "Đang có một tác vụ blockchain khác." : "Another blockchain operation is running.");
      return;
    }

    const original = loadBills(owner).find(bill => bill.id === billId);
    if (!original) {
      note(vi ? "Không tìm thấy hóa đơn." : "Bill not found in this browser.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setVerifyingBillId(billId);
    note(vi ? "Đang kết nối Arc Testnet..." : "Connecting to Arc Testnet...");

    try {
      if (original.txHash && original.stage !== "confirmed") {
        note(vi ? "Đang kiểm tra giao dịch tạo hóa đơn..." : "Checking creation transaction...");
        await waitForBatchReceipt(provider, original.txHash);
      }

      const members = [...original.members];
      for (let index = 0; index < members.length; index++) {
        if (!verifyPaid && original.stage === "confirmed" && members[index].status === "paid") {
          continue;
        }

        note(vi
          ? `Đang đối soát ${index + 1}/${members.length} thành viên...`
          : `Checking member ${index + 1}/${members.length}...`);

        let chain;
        try {
          chain = await readBatchLink(provider, members[index].id);
        } catch (error) {
          if (isRateLimited(error)) {
            const message = vi
              ? `Arc RPC giới hạn truy vấn tại ${index + 1}/${members.length}. Thử lại sau.`
              : `Arc RPC rate limit at ${index + 1}/${members.length}. Try again later.`;
            note(message);
            toast.error(message);
            return;
          }
          throw error;
        }

        if (chain.creator.toLowerCase() !== owner.toLowerCase() ||
            chain.amount !== BigInt(members[index].raw)) {
          if (chain.creator.toLowerCase() === ZERO_ADDRESS) {
            const message = vi
              ? "Payment Link không tồn tại trên blockchain. Kiểm tra Tx tạo hóa đơn."
              : "Payment Link not found on-chain. Check the creation Tx.";
            note(message);
            toast.error(message);
            return;
          }
          throw new Error("On-chain owner or amount mismatch. Nothing further was updated.");
        }

        members[index] = {
          ...members[index],
          status: chain.paid ? "paid" : "unpaid",
          payer: chain.payer,
        };

        // Persist each verified member without changing other bills.
        saveBill(owner, { ...original, stage: "confirmed", members: [...members] });
        if (index < members.length - 1) await sleep(400);
      }

      const stamp = new Date().toISOString();
      setVerifiedAt(previous => ({ ...previous, [billId]: stamp }));
      note(vi ? "Đã đối soát thành công hóa đơn này." : "This bill was verified on-chain.");
      toast.success(vi ? "Đối soát hóa đơn thành công." : "Bill verified on-chain.");
    } catch (error) {
      const message = errorMessage(error);
      note(message);
      toast.error(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setVerifyingBillId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* PRIMARY NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTools(false)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            !showTools
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <Layers3 size={15} />
          {vi ? "\u0054\u1ea1o bill" : "Create bill"}
        </button>

        <button
          type="button"
          onClick={() => setShowTools(true)}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            showTools
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {vi ? "C\u00f4ng c\u1ee5" : "Tools"}
        </button>
      </div>

      {showTools && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setUtilityPanel("telegram")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              utilityPanel === "telegram"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
            }`}
          >
            Telegram{contacts.length > 0 ? ` / ${contacts.length}` : ""}
          </button>

          <button
            type="button"
            onClick={() => setUtilityPanel("history")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              utilityPanel === "history"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
            }`}
          >
            {vi ? "L\u1ecbch s\u1eed h\u00f3a \u0111\u01a1n" : "Bill history"} / {bills.length}
          </button>

          <button
            type="button"
            onClick={() => setUtilityPanel("advanced")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              utilityPanel === "advanced"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
            }`}
          >
            {vi ? "N\u00e2ng cao" : "Advanced"}
          </button>
        </div>
      )}

      {showTools && utilityPanel === "telegram" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">
          <TelegramSyncCard />
        </section>
      )}

      {showTools && utilityPanel === "history" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {!ready && bills.length > 0 && (
            <p
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              {vi
                ? "Chưa thể đối soát: hãy kết nối ví chủ, chọn Arc Testnet và kiểm tra cấu hình Batch Contract."
                : "Verification unavailable: connect the bill owner wallet, switch to Arc Testnet and check the Batch Contract configuration."}
            </p>
          )}

          <BillHistoryPanel
            bills={bills}
            vi={vi}
            busy={busy}
            canVerify={ready}
            verifyingBillId={verifyingBillId}
            verificationMessages={verificationMessages}
            verifiedAt={verifiedAt}
            onVerify={(billId, full) => {
              void reconcile(billId, full);
            }}
          />
        </section>
      )}

      {!showTools && (
        <>
      {/* CREATE BATCH */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Layers3 size={19} />

          {vi
            ? "Tạo tất cả Payment Links trong một giao dịch"
            : "Batch Create — one transaction"}
        </h2>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {vi
            ? "Chia đều hóa đơn, đặt tên thành viên và tạo Payment Links trong một giao dịch."
            : "Split a total, name members and create all payment links in one transaction."}
        </p>

        {!batchIsConfigured() && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {vi
              ? "Chưa cấu hình Batch Contract. Kiểm tra NEXT_PUBLIC_BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS."
              : "Configure NEXT_PUBLIC_BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS first."}
          </p>
        )}

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              ✨ AI Command
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              {vi
                ? "Gõ lệnh tự nhiên để tự điền bill. Bạn vẫn xác nhận giao dịch bằng Rabby."
                : "Use natural language to fill the bill. You still confirm the transaction in Rabby."}
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={aiCommand}
              onChange={event =>
                setAiCommand(event.target.value)
              }
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  parseAiCommand();
                }
              }}
              placeholder={
                vi
                  ? "Ví dụ: Tạo bill Cafe 10 USDC cho Huy, Nhung, Bao"
                  : "Example: Create a Cafe bill for 10 USDC for Huy, Nhung, Bao"
              }
              className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-100"
            />

            <button
              type="button"
              onClick={parseAiCommand}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {vi ? "Hiểu lệnh" : "Parse command"}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {vi
              ? "Ví dụ: “Tạo bill 10 USDC cho A, B, C”, “Tạo bill 5 USDC cho Huy”, “Split 30 USDC between Huy, Bao, Nhung”."
              : "Examples: “Create a 10 USDC bill for A, B, C”, “Create a 5 USDC bill for Huy”, “Split 30 USDC between Huy, Bao, Nhung”."}
          </p>
        </div>

        <form
          onSubmit={event =>
            void createAll(event)
          }
          className="mt-4 space-y-3"
        >
          <label className="block text-sm font-medium">
            {vi ? "Tên hóa đơn" : "Bill title"}

            <input
              value={title}
              onChange={event =>
                setTitle(event.target.value)
              }
              maxLength={80}
              placeholder="Lunch"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {vi
                ? "Tổng (USDC)"
                : "Total (USDC)"}

              <input
                value={amount}
                onChange={event =>
                  setAmount(event.target.value)
                }
                placeholder="9"
                required
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>

            <label className="block text-sm font-medium">
              {vi
                ? "Số người (1–100)"
                : "People (1–100)"}

              <input
                type="number"
                min={1}
                max={100}
                value={people}
                onChange={event =>
                  setPeople(Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>

          {groupSize > 0 && (
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
              {Array.from(
                { length: groupSize },
                (_, index) => (
                  <div
                    key={index}
                    className="text-xs"
                  >
                    <label>
                      {vi
                        ? "Người"
                        : "Person"}{" "}
                      {index + 1}

                      <input
                        maxLength={60}
                        value={names[index] || ""}
                        onChange={event =>
                          setName(
                            index,
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        placeholder={`Name ${index + 1}`}
                      />
                    </label>

                    <select
                      aria-label={`Telegram member ${index + 1}`}
                      value={
                        chosenIds[index] || ""
                      }
                      onChange={event =>
                        chooseName(
                          index,
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">
                        — No Telegram member selected —
                      </option>

                      {contacts
                        .filter(contact => {
                          const search =
                            names[index]
                              ?.trim()
                              .toLocaleLowerCase() || "";

                          return (
                            !search ||
                            (
                              contact.display_name +
                              " " +
                              contact.full_name +
                              " " +
                              (contact.username || "")
                            )
                              .toLocaleLowerCase()
                              .includes(search) ||
                            contact.id ===
                              chosenIds[index]
                          );
                        })
                        .map(contact => (
                          <option
                            key={contact.id}
                            value={contact.id}
                          >
                            {contact.display_name}
                            {contact.full_name
                              ? ` · ${contact.full_name}`
                              : ""}
                            {contact.username
                              ? ` (@${contact.username})`
                              : ""}
                          </option>
                        ))}
                    </select>

                    {chosenIds[index] ? (
                      <p className="mt-1 text-emerald-600">
                        ✓ Telegram registered
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-600">
                        Not linked to Telegram — payment link only
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Type a saved member name or choose from
            the dropdown. Registered members can
            receive Telegram notifications after sync.
          </p>

          {validTotal !== null && (
            <p className="text-xs text-blue-600 dark:text-blue-300">
              {vi
                ? "Mỗi người khoảng"
                : "Each person about"}{" "}
              {token(
                (
                  validTotal /
                  BigInt(groupSize)
                ).toString()
              )}{" "}
              USDC.
            </p>
          )}

          <button
            type="submit"
            disabled={
              !ready ||
              busy ||
              validTotal === null
            }
            className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? vi
                ? "Đang xử lý..."
                : "Working..."
              : "Create All — 1 Transaction"}
          </button>
        </form>

        {progress && (
          <p
            role="status"
            className="mt-3 break-all rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200"
          >
            {progress}
          </p>
        )}

        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
          Arc Testnet only. Up to 100 links per
          transaction if gas permits. Never blindly
          resend after a wallet error.
        </p>
      </section>

        </>
      )}

      {showTools && utilityPanel === "advanced" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h3 className="font-semibold">
              {vi ? "Chi tiết & công cụ nâng cao" : "Details & advanced tools"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {vi
                ? "Link ID, payer, Verify, Explorer và dữ liệu kỹ thuật"
                : "Link IDs, payer, Verify, Explorer and technical data"}
            </p>
          </div>
      {/* EXISTING BILL DETAILS */}
      {bills.map(bill => {
        const paidMembers =
          bill.members.filter(
            member =>
              member.status === "paid"
          );

        const received =
          paidMembers.reduce(
            (total, member) =>
              total + BigInt(member.raw),
            0n
          );

        return (
          <section
            key={bill.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  {bill.title}
                </h3>

                <p className="mt-1 break-all text-[11px] text-slate-500">
                  Bill ID: {bill.id}{" "}

                  <button
                    type="button"
                    className="ml-1 underline"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(bill.id)
                        .then(() =>
                          toast.success(
                            "Bill ID copied"
                          )
                        )
                        .catch(() =>
                          toast.error(
                            "Could not copy Bill ID"
                          )
                        );
                    }}
                  >
                    Copy ID
                  </button>
                </p>

                <p className="text-xs text-slate-500">
                  {new Date(
                    bill.createdAt
                  ).toLocaleString(
                    vi ? "vi-VN" : "en-US"
                  )}{" "}
                  · {bill.stage}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!ready || (busy && verifyingBillId === null) || verifyingBillId === bill.id}
                  onClick={() =>
                    void reconcile(bill.id)
                  }
                  className={btn}
                >
                  <RefreshCcw
                    size={14}
                    className="mr-1 inline"
                  />
                  Verify All
                </button>

                <button
                  type="button"
                  disabled={!ready || (busy && verifyingBillId === null) || verifyingBillId === bill.id}
                  onClick={() =>
                    void reconcile(
                      bill.id,
                      true
                    )
                  }
                  className={btn}
                >
                  {vi
                    ? "Kiểm tra toàn bộ"
                    : "Full Recheck"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm">
              {vi ? "Đã thu" : "Received"}:{" "}

              <strong className="text-emerald-600">
                {token(
                  received.toString()
                )}
                /
                {token(
                  bill.totalRaw
                )}{" "}
                USDC
              </strong>

              {" · "}

              {vi ? "Đã trả" : "Paid"}{" "}
              {paidMembers.length}/
              {bill.members.length}
            </p>

            {bill.txHash && (
              <p className="mt-2 text-xs">
                <a
                  href={explorerTxUrl(
                    bill.txHash
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline dark:text-blue-400"
                >
                  {vi
                    ? "Xem giao dịch tạo hàng loạt"
                    : "View batch creation Tx"}{" "}
                  ↗
                </a>
              </p>
            )}

            {!bill.txHash &&
              bill.stage ===
                "needs_review" && (
                <p className="mt-2 text-xs text-amber-600">
                  {vi
                    ? "Ví không trả mã giao dịch. Kiểm tra Explorer trước khi thử tạo lại."
                    : "Wallet returned no transaction hash. Check Explorer before retrying."}
                </p>
              )}

            <div className="mt-4 space-y-2">
              {bill.members.map(member => {
                const link =
                  typeof window !==
                  "undefined"
                    ? `${window.location.origin}/pay/split/${member.id}`
                    : "";

                return (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <input
                          aria-label="Participant name"
                          value={member.name}
                          maxLength={60}
                          onChange={event =>
                            modifyMember(
                              bill.id,
                              member.id,
                              {
                                name:
                                  event.target.value,
                              }
                            )
                          }
                          className="w-40 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />

                        <strong>
                          {token(
                            member.raw
                          )}{" "}
                          USDC
                        </strong>

                        {contacts.length > 0 && (
                          <select
                            aria-label="Assign Telegram contact for existing link"
                            value={
                              member.directoryId ||
                              ""
                            }
                            disabled={
                              !!member.directoryId
                            }
                            onChange={event => {
                              const contact =
                                contacts.find(
                                  item =>
                                    item.id ===
                                    event.target.value
                                );

                              modifyMember(
                                bill.id,
                                member.id,
                                {
                                  directoryId:
                                    event.target.value ||
                                    null,

                                  ...(contact
                                    ? {
                                        name:
                                          contact.display_name,
                                      }
                                    : {}),
                                }
                              );
                            }}
                            className="max-w-48 rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800"
                          >
                            <option value="">
                              Telegram: not assigned
                            </option>

                            {contacts.map(contact => (
                              <option
                                key={contact.id}
                                value={contact.id}
                              >
                                {
                                  contact.display_name
                                }

                                {contact.username
                                  ? ` (@${contact.username})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {member.status ===
                        "paid"
                          ? vi
                            ? "Đã thanh toán"
                            : "Paid"
                          : member.status ===
                            "unpaid"
                          ? vi
                            ? "Chưa thanh toán"
                            : "Unpaid"
                          : vi
                          ? "Đang chờ xác minh"
                          : "Pending verification"}
                      </p>

                      {member.payer &&
                        member.status ===
                          "paid" && (
                          <p className="break-all text-xs text-slate-500">
                            Payer:{" "}
                            {member.payer}
                          </p>
                        )}
                    </div>

                    <button
                      type="button"
                      className={btn}
                      disabled={
                        bill.stage !==
                        "confirmed"
                      }
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() =>
                            toast.success(
                              "Copied"
                            )
                          )
                          .catch(() =>
                            toast.error(
                              "Copy failed"
                            )
                          );
                      }}
                    >
                      <Copy
                        size={14}
                        className="inline"
                      />{" "}
                      Copy
                    </button>

                    {bill.stage ===
                      "confirmed" && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className={btn}
                      >
                        <ExternalLink
                          size={14}
                          className="inline"
                        />{" "}
                        Link
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
        </section>
      )}
    </div>
  );
}
