"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import { CheckCircle2, Copy, ExternalLink, RefreshCw, Users } from "lucide-react";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";

import { useAppearance } from "@/contexts/AppearanceContext";

import { createLinkOnChain, generateOnChainLinkId, getLinkOnChain, isPaymentLinksContractConfigured } from "@/lib/web3/paymentLinksContract";

import { PAYMENT_LINKS_CONTRACT_ADDRESS, USDC_DECIMALS, explorerTxUrl } from "@/lib/web3/config";

import { formatUnits } from "@/lib/web3/erc20";

import type { Eip1193Provider } from "@/lib/web3/provider";



type Member = { id: string; label: string; amountRaw: string; hash: string; status: "creating" | "confirming" | "unpaid" | "paid" | "error"; error?: string };

type Bill = { id: string; owner: string; title: string; totalRaw: string; members: Member[]; createdAt: string };

type StoredLink = { id: string; creator: string; memo: string; createdAt: string; createHash: string };

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

const idPattern = /^0x[a-fA-F0-9]{64}$/;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const currency = (raw: string) => formatUnits(BigInt(raw), USDC_DECIMALS);

function parseAmount(input: string): bigint {

  const value = input.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error("Use a positive USDC amount with at most 6 decimals.");

  const [whole, fraction = ""] = value.split(".");

  const raw = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0") || "0");

  if (raw <= 0n) throw new Error("Total amount must be greater than zero.");

  return raw;

}

function storageKey(address: string) { return `flowusd:split-bills:v1:${PAYMENT_LINKS_CONTRACT_ADDRESS.toLowerCase()}:${address.toLowerCase()}`; }

function linksKey(address: string) { return `flowusd:onchain-links:${PAYMENT_LINKS_CONTRACT_ADDRESS.toLowerCase()}:${address.toLowerCase()}`; }

function statesKey(address: string) { return linksKey(address) + ":verified-state"; }

function readBills(address: string): Bill[] {

  try {

    const value: unknown = JSON.parse(localStorage.getItem(storageKey(address)) || "[]");

    if (!Array.isArray(value)) return [];

    return value.filter((b): b is Bill => Boolean(b && typeof b === "object" && typeof b.id === "string" && Array.isArray(b.members) && b.owner?.toLowerCase() === address.toLowerCase()));

  } catch { return []; }

}

function persistBills(address: string, bills: Bill[]) { localStorage.setItem(storageKey(address), JSON.stringify(bills)); }

function addToPaymentLinks(address: string, member: Member, title: string, createdAt: string) {

  try {

    const key = linksKey(address);

    const links = JSON.parse(localStorage.getItem(key) || "[]") as StoredLink[];

    if (!links.some((link) => link.id.toLowerCase() === member.id.toLowerCase())) {

      links.unshift({ id: member.id, creator: address, memo: `${title} • ${member.label}`, createdAt, createHash: member.hash });

      localStorage.setItem(key, JSON.stringify(links));

    }

  } catch (error) { console.warn("Could not update payment links cache", error); }

}

// Names are local metadata. Editing a name never changes its on-chain link.

function updatePaymentLinkMemo(address: string, member: Member, billTitle: string) {

  try {

    const key = linksKey(address);

    const existing = JSON.parse(localStorage.getItem(key) || "[]") as StoredLink[];

    const updated = existing.map((link) =>

      link.id.toLowerCase() === member.id.toLowerCase()

        ? { ...link, memo: `${billTitle} • ${member.label}` }

        : link

    );

    localStorage.setItem(key, JSON.stringify(updated));

  } catch (error) {

    console.warn("Unable to update local link description", error);

  }

}

function persistVerifiedState(address: string, member: Member, chain: Awaited<ReturnType<typeof getLinkOnChain>>) {

  try {

    const key = statesKey(address);

    const states = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, unknown>;

    states[member.id.toLowerCase()] = { amount: chain.amount.toString(), paid: chain.paid, payer: chain.payer, paidAt: chain.paidAt.toString(), verifiedAt: Date.now() };

    localStorage.setItem(key, JSON.stringify(states));

  } catch { /* Cache failure must never change on-chain status */ }

}

async function confirm(provider: Eip1193Provider, hash: string): Promise<void> {

  for (let count = 0; count < 40; count++) {

    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string } | null;

    if (receipt) {

      if (receipt.status === "0x1" || receipt.status === "0x01") return;

      throw new Error(`Transaction reverted: ${hash}`);

    }

    await sleep(2200);

  }

  throw new Error(`Confirmation pending. Save this transaction hash: ${hash}`);

}

// Verify uses READ-ONLY eth_call. Never signs or sends transactions.

// Keep progress per wallet/bill so a rate limit does not restart the batch.

const VERIFY_DELAY_MS = 650;

const VERIFY_RETRIES = 2;

const VERIFY_COOLDOWN_MS = 12_000;

function verifyCursorKey(owner: string, billId: string) {

  return `${storageKey(owner)}:verify-cursor:${billId}`;

}

function getVerifyCursor(owner: string, billId: string): number {

  try {

    const raw = localStorage.getItem(verifyCursorKey(owner, billId));

    const index = Number(raw ?? "0");

    return Number.isSafeInteger(index) && index >= 0 ? index : 0;

  } catch { return 0; }

}

function saveVerifyCursor(owner: string, billId: string, index: number) {

  try { localStorage.setItem(verifyCursorKey(owner, billId), String(index)); }

  catch { /* progress persistence is best-effort */ }

}

function rpcErrorText(error: unknown): string {

  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {

    const obj = error as { message?: unknown; code?: unknown; data?: unknown };

    return `${String(obj.message ?? "RPC request failed")} ${String(obj.code ?? "")} ${String(obj.data ?? "")}`;

  }

  return String(error);

}

function isRateLimit(error: unknown): boolean {

  const text = rpcErrorText(error);

  return /429|rate.?limit|too many requests|request exceeds defined limit|limit exceeded|-32005/i.test(text);

}

async function readLinkWithBackoff(provider: Eip1193Provider, id: string) {

  let lastError: unknown;

  for (let attempt = 0; attempt <= VERIFY_RETRIES; attempt++) {

    try { return await getLinkOnChain(provider, id); }

    catch (error) {

      lastError = error;

      if (!isRateLimit(error) || attempt === VERIFY_RETRIES) break;

      await sleep(2500 * 2 ** attempt);

    }

  }

  throw lastError instanceof Error ? lastError : new Error(rpcErrorText(lastError));

}

type VerifyProgress = { billId: string; done: number; total: number; checked: number; status: string };
type SplitMode = "equal" | "custom";

export default function SplitBillCard() {

  const wallet = useWeb3Wallet();

  const { language } = useAppearance();

  const vi = language === "vi";

  const [title, setTitle] = useState("");

  const [total, setTotal] = useState("");

  const [count, setCount] = useState(3);

  const [splitMode, setSplitMode] = useState<SplitMode>("equal");

  const [memberNames, setMemberNames] = useState<string[]>([]);

  const [memberAmounts, setMemberAmounts] = useState<string[]>([]);

  const [bills, setBills] = useState<Bill[]>([]);

  const [busy, setBusy] = useState(false);

  const [verifyProgress, setVerifyProgress] = useState<VerifyProgress | null>(null);

  const verifyStopRef = useRef(false);

  const verifyCooldownRef = useRef(0);



  const busyRef = useRef(false);

  const owner = wallet.address;

  const ready = !!owner && !!wallet.provider && wallet.isOnArcTestnet && isPaymentLinksContractConfigured();

  useEffect(() => { verifyStopRef.current = true; setVerifyProgress(null); setBills(owner ? readBills(owner) : []); }, [owner]);

  const splitPreview = useMemo(() => {

    try {

      const totalRaw = parseAmount(total);

      if (!Number.isInteger(count) || count < 2 || count > 100) return null;

      if (splitMode === "equal") {

        if (totalRaw < BigInt(count)) return null;

        const base = totalRaw / BigInt(count);

        const remainder = Number(totalRaw % BigInt(count));

        return {
          valid: true,
          assignedRaw: totalRaw,
          remainingRaw: 0n,
          amounts: Array.from({ length: count }, (_, i) => base + (i < remainder ? 1n : 0n)),
          small: currency(base.toString()),
          extra: currency((base + (remainder ? 1n : 0n)).toString()),
        };
      }

      const amounts: bigint[] = [];

      for (let i = 0; i < count; i++) {

        const value = memberAmounts[i]?.trim() ?? "";

        if (!value) {

          const assignedRaw = amounts.reduce((sum, amount) => sum + amount, 0n);

          return {
            valid: false,
            assignedRaw,
            remainingRaw: totalRaw - assignedRaw,
            amounts,
            small: "",
            extra: "",
          };
        }

        amounts.push(parseAmount(value));
      }

      const assignedRaw = amounts.reduce((sum, amount) => sum + amount, 0n);

      return {
        valid: assignedRaw === totalRaw,
        assignedRaw,
        remainingRaw: totalRaw - assignedRaw,
        amounts,
        small: "",
        extra: "",
      };

    } catch { return null; }

  }, [total, count, splitMode, memberAmounts]);

  const store = useCallback((address: string, updated: Bill[]) => { persistBills(address, updated); setBills(updated); }, []);

  const update = useCallback((address: string, billId: string, memberId: string, patch: Partial<Member>) => {

    const next = readBills(address).map((b) => b.id !== billId ? b : ({ ...b, members: b.members.map((m) => m.id === memberId ? ({ ...m, ...patch }) : m) }));

    store(address, next);

  }, [store]);

  const rename = useCallback((bill: Bill, member: Member, label: string) => {

    if (!owner || owner.toLowerCase() !== bill.owner.toLowerCase()) return;

    // A blank field is allowed while typing. Fallback is applied on blur.

    update(owner, bill.id, member.id, { label: label.slice(0, 60) });

    updatePaymentLinkMemo(owner, { ...member, label: label.slice(0, 60) }, bill.title);

  }, [owner, update]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!ready || !owner || busyRef.current) return;

    let totalRaw: bigint;

    try { totalRaw = parseAmount(total); }

    catch (error) { toast.error(error instanceof Error ? error.message : "Invalid amount"); return; }

    if (!Number.isInteger(count) || count < 2 || count > 100) {

      toast.error(vi ? "Số người phải từ 2–100." : "People must be between 2 and 100.");

      return;
    }

    if (!splitPreview || !splitPreview.valid || splitPreview.amounts.length !== count) {

      toast.error(
        splitMode === "custom"
          ? (vi ? "Tổng số tiền từng người phải đúng bằng tổng hóa đơn và mỗi người phải lớn hơn 0." : "Custom amounts must add up exactly to the bill total and every amount must be greater than zero.")
          : (vi ? "Không thể chia đều số tiền này cho số người đã chọn." : "This total cannot be split across the selected people.")
      );

      return;
    }

    const createdAt = new Date().toISOString();

    const label = title.trim() || (vi ? "Chia tiền" : "Split bill");

    const members: Member[] = Array.from({ length: count }, (_, i) => ({

      id: generateOnChainLinkId(),

      label: memberNames[i]?.trim().slice(0, 60) || `${vi ? "Người" : "Person"} ${i + 1}`,

      amountRaw: splitPreview.amounts[i].toString(),

      hash: "",

      status: "creating",

    }));

    const bill: Bill = { id: generateOnChainLinkId(), owner, title: label, totalRaw: totalRaw.toString(), members, createdAt };

    store(owner, [bill, ...readBills(owner)]);

    setTitle("");

    setTotal("");

    setMemberNames([]);

    setMemberAmounts([]);

    setSplitMode("equal");

    toast.success(vi ? "Đã lưu hóa đơn. Kiểm tra số tiền từng người rồi tạo link." : "Bill saved. Review each amount, then create the payment links.");

  }



  // Submit only ONE wallet transaction per explicit click. Rabby may reject

  // automatic multi-transaction flows on Arc's custom RPC.

  async function createMemberLink(bill: Bill, member: Member) {

    if (!ready || !wallet.provider || !owner || busyRef.current || bill.owner.toLowerCase() !== owner.toLowerCase()) return;

    if (member.status === "paid" || member.status === "unpaid") return;

    busyRef.current = true;

    setBusy(true);

    const provider = wallet.provider;

    let knownHash = member.hash;

    try {

      // A previously returned hash MUST be reconciled before ever resending.

      if (knownHash) {

        await confirm(provider, knownHash);

      } else {

        // In case Rabby submitted a tx but failed to return its hash, first

        // check whether this exact bytes32 ID already exists on chain.

        let alreadyCreated = false;

        try {

          const current = await getLinkOnChain(provider, member.id);

          if (current.creator.toLowerCase() === owner.toLowerCase() && current.amount === BigInt(member.amountRaw)) {

            alreadyCreated = true;

          } else if (current.creator !== "0x0000000000000000000000000000000000000000") {

            throw new Error("This link ID already belongs to another payment request.");

          }

        } catch (error) {

          // A transient RPC failure is NOT proof the ID is unused: stop safely.

          throw new Error(vi ? "Chưa xác minh được Link ID trên chain. Thử lại sau, không gửi trùng giao dịch." : "Could not verify this Link ID on-chain. Retry later, do not submit a duplicate.", { cause: error });

        }

        if (!alreadyCreated) {

          knownHash = await createLinkOnChain(provider, owner, member.id, BigInt(member.amountRaw));

          update(owner, bill.id, member.id, { hash: knownHash, status: "confirming", error: "" });

          await confirm(provider, knownHash);

        }

      }

      const chain = await getLinkOnChain(provider, member.id);

      if (chain.creator.toLowerCase() !== owner.toLowerCase() || chain.amount !== BigInt(member.amountRaw)) {

        throw new Error("Contract returned a different recipient or amount.");

      }

      const verifiedMember: Member = { ...member, hash: knownHash, status: chain.paid ? "paid" : "unpaid", error: "" };

      addToPaymentLinks(owner, verifiedMember, bill.title, bill.createdAt);

      persistVerifiedState(owner, verifiedMember, chain);

      update(owner, bill.id, member.id, { hash: knownHash, status: verifiedMember.status, error: "" });

      toast.success(vi ? `Link của ${member.label} đã được xác minh.` : `${member.label}'s link verified.`);

    } catch (error) {

      const message = error instanceof Error ? error.message : String(error);

      update(owner, bill.id, member.id, { hash: knownHash, status: knownHash ? "confirming" : "error", error: message });

      toast.error(vi ? `Không thể tạo/xác minh link của ${member.label}. Không tự gửi lại.` : `Could not create/verify ${member.label}'s link. No automatic retry.`);

    } finally {

      busyRef.current = false;

      setBusy(false);

    }

  }



  // One click per bill: verify all outstanding links without rechecking paid

  // links. A second button explicitly allows a full re-audit when desired.

  async function refreshBill(bill: Bill, force = false) {

    if (!ready || !wallet.provider || !owner || busyRef.current ||

      bill.owner.toLowerCase() !== owner.toLowerCase()) return;

    const now = Date.now();

    if (now < verifyCooldownRef.current) {

      toast.error(vi ? "RPC đang giới hạn truy vấn. Đợi vài giây rồi tiếp tục." : "RPC rate limit. Wait a moment before resuming.");

      return;

    }

    const provider = wallet.provider;

    // Resolve latest saved metadata; don't rely on a stale render snapshot.

    const currentBill = readBills(owner).find(b => b.id === bill.id);

    if (!currentBill) return;

    const members = currentBill.members;

    let startAt = force ? 0 : Math.min(getVerifyCursor(owner, bill.id), members.length);

    // A previous finished pass restarts at the beginning to catch new payments.

    if (startAt >= members.length) startAt = 0;

    if (force) saveVerifyCursor(owner, bill.id, 0);

    const applicable = members.slice(startAt).filter(m =>

      (force || m.status !== "paid") && (m.status === "unpaid" || m.status === "paid" || m.status === "confirming" || Boolean(m.hash))

    );

    if (!applicable.length) {

      saveVerifyCursor(owner, bill.id, 0);

      toast.message(vi ? "Không có link nào cần đối soát. Dùng 'Kiểm tra cả đã trả' để xác minh lại tất cả." : "No outstanding links. Use Full recheck to include paid links.");

      return;

    }

    busyRef.current = true;

    verifyStopRef.current = false;

    setBusy(true);

    let checked = 0;

    let done = 0;

    let failedMessage = "";

    setVerifyProgress({ billId: bill.id, done: 0, total: applicable.length, checked: 0,

      status: vi ? "Đang xác minh trên blockchain..." : "Verifying on-chain..." });

    try {

      for (let i = startAt; i < members.length; i++) {

        if (verifyStopRef.current) {

          failedMessage = vi ? "Đã tạm dừng. Nhấn Đối soát để tiếp tục." : "Paused. Click Verify to resume.";

          break;

        }

        const member = members[i];

        // Not created yet: no link exists to verify. No RPC call necessary.

        const eligible = force || member.status !== "paid";

        const created = member.status === "unpaid" || member.status === "paid" || member.status === "confirming" || Boolean(member.hash);

        if (!eligible || !created) {

          saveVerifyCursor(owner, bill.id, i + 1);

          continue;

        }

        try {

          const chain = await readLinkWithBackoff(provider, member.id);

          // NEVER change status based on a different creator or amount.

          if (chain.creator.toLowerCase() === "0x0000000000000000000000000000000000000000") {

            throw new Error("Link is not registered on-chain yet.");

          }

          if (chain.creator.toLowerCase() !== owner.toLowerCase() ||

              chain.amount !== BigInt(member.amountRaw)) {

            throw new Error("On-chain creator or amount mismatch.");

          }

          const status: Member["status"] = chain.paid ? "paid" : "unpaid";

          const verifiedMember = { ...member, status };

          addToPaymentLinks(owner, verifiedMember, currentBill.title, currentBill.createdAt);

          persistVerifiedState(owner, verifiedMember, chain);

          update(owner, bill.id, member.id, { status, error: "" });

          checked++;

          done++;

          saveVerifyCursor(owner, bill.id, i + 1);

        } catch (error) {

          // Keep the last known state and cursor. Never claim an RPC failure is unpaid.

          const reason = rpcErrorText(error);

          const limited = isRateLimit(error);

          failedMessage = limited

            ? (vi ? "Arc RPC tạm giới hạn lượt đọc. Tiến độ đã lưu, thử tiếp sau ít phút." : "Arc RPC is rate limited. Progress saved; resume after a short break.")

            : (vi ? `Đối soát tạm dừng ở ${member.label}: ${reason}` : `Verification paused at ${member.label}: ${reason}`);

          if (limited) verifyCooldownRef.current = Date.now() + VERIFY_COOLDOWN_MS;

          console.warn("[SplitBill verify]", reason);

          break;

        }

        setVerifyProgress({ billId: bill.id, done, total: applicable.length, checked,

          status: vi ? `Đã kiểm tra ${checked}/${applicable.length} link cần đối soát` : `Checked ${checked}/${applicable.length} outstanding links` });

        await sleep(VERIFY_DELAY_MS);

      }

      if (!failedMessage) {

        saveVerifyCursor(owner, bill.id, 0);

        toast.success(vi ? `Đối soát xong ${checked} link. Các link đã trả được giữ nguyên.` : `Verified ${checked} links. Paid links were preserved.`);

      } else {

        toast.message(failedMessage);

      }

    } finally {

      setVerifyProgress({ billId: bill.id, done, total: applicable.length, checked,

        status: failedMessage || (vi ? "Đã đối soát xong." : "Verification completed.") });

      busyRef.current = false;

      setBusy(false);

    }

  }

  const btn = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-600";

  return <div className="space-y-6">

    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">

      <h2 className="flex items-center gap-2 text-xl font-bold"><Users size={21}/>{vi ? "Chia hóa đơn USDC" : "Split a USDC bill"}</h2>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{vi ? "Một khoản tiền, nhiều người trả. Mỗi người nhận một đường dẫn thanh toán riêng." : "One total, individual on-chain payment links for each person."}</p>

      <form className="mt-5 space-y-4" onSubmit={handleCreate}>

        <label className="block text-sm font-medium">{vi ? "Tên hóa đơn" : "Bill title"}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} placeholder={vi ? "Ví dụ: Tiền ăn trưa" : "e.g. Lunch"} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" /></label>

        <div className="grid gap-4 sm:grid-cols-2">

          <label className="block text-sm font-medium">{vi ? "Tổng tiền (USDC)" : "Total (USDC)"}<input required inputMode="decimal" value={total} onChange={e=>setTotal(e.target.value)} placeholder="10" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" /></label>

          <label className="block text-sm font-medium">{vi ? "Số người (2–100)" : "People (2–100)"}<input required type="number" min={2} max={100} step={1} value={count} onChange={e=>setCount(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" /></label>

        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <p className="text-sm font-semibold">{vi ? "Cách chia tiền" : "Split method"}</p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">

                {vi ? "Chọn chia đều hoặc nhập số tiền riêng cho từng người." : "Split equally or assign a custom amount to each participant."}

              </p>

            </div>

            <div className="inline-flex rounded-xl border border-slate-300 p-1 dark:border-slate-600">

              <button

                type="button"

                onClick={() => setSplitMode("equal")}

                className={`rounded-lg px-3 py-2 text-sm font-semibold ${splitMode === "equal" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}

              >

                {vi ? "Chia đều" : "Equal Split"}

              </button>

              <button

                type="button"

                onClick={() => setSplitMode("custom")}

                className={`rounded-lg px-3 py-2 text-sm font-semibold ${splitMode === "custom" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}

              >

                {vi ? "Tùy chỉnh" : "Custom Split"}

              </button>

            </div>

          </div>

        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">

          <p className="mb-1 text-sm font-semibold">{vi ? "Người tham gia" : "Participants"}</p>

          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">

            {splitMode === "custom"

              ? (vi ? "Nhập tên và số USDC của từng người. Tổng phải đúng bằng tổng hóa đơn." : "Enter each participant name and USDC amount. The assigned total must match the bill total exactly.")

              : (vi ? "Tên chỉ lưu trên trình duyệt. FlowUSD sẽ tự chia tổng tiền chính xác cho mọi người." : "Names stay in your browser. FlowUSD will distribute the exact bill total automatically.")}

          </p>

          <div className="grid gap-3 sm:grid-cols-2">

            {Array.from({ length: Number.isInteger(count) && count >= 2 && count <= 100 ? count : 0 }, (_, i) => (

              <div key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">

                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">

                  {vi ? `Người ${i + 1}` : `Person ${i + 1}`}

                  <input

                    type="text"

                    maxLength={60}

                    value={memberNames[i] ?? ""}

                    onChange={(event) => setMemberNames((old) => {

                      const next = [...old];

                      next[i] = event.target.value;

                      return next;

                    })}

                    placeholder={vi ? `Tên người ${i + 1}` : `Name ${i + 1}`}

                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"

                  />

                </label>

                {splitMode === "custom" ? (

                  <label className="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-300">

                    {vi ? "Số tiền (USDC)" : "Amount (USDC)"}

                    <input

                      type="text"

                      inputMode="decimal"

                      value={memberAmounts[i] ?? ""}

                      onChange={(event) => setMemberAmounts((old) => {

                        const next = [...old];

                        next[i] = event.target.value;

                        return next;

                      })}

                      placeholder="0.00"

                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"

                    />

                  </label>

                ) : (

                  <p className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400">

                    {splitPreview?.amounts[i] !== undefined ? `${currency(splitPreview.amounts[i].toString())} USDC` : "—"}

                  </p>

                )}

              </div>

            ))}

          </div>

        </div>

        {splitMode === "equal" && splitPreview && (

          <p className="text-sm text-blue-600 dark:text-blue-400">

            {vi ? "Mỗi người khoảng" : "Per person about"} {splitPreview.small}–{splitPreview.extra} USDC. {vi ? "Tổng luôn chính xác." : "Exact total preserved."}

          </p>

        )}

        {splitMode === "custom" && splitPreview && (

          <div className={`rounded-xl border p-3 text-sm ${splitPreview.valid ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>

            <div className="flex flex-wrap justify-between gap-2">

              <span>{vi ? "Đã phân bổ" : "Assigned"}: <strong>{currency(splitPreview.assignedRaw.toString())} USDC</strong></span>

              <span>

                {splitPreview.remainingRaw >= 0n ? (vi ? "Còn lại" : "Remaining") : (vi ? "Vượt quá" : "Over")}

                : <strong>{currency((splitPreview.remainingRaw >= 0n ? splitPreview.remainingRaw : -splitPreview.remainingRaw).toString())} USDC</strong>

              </span>

            </div>

            <p className="mt-1 text-xs">

              {splitPreview.valid

                ? (vi ? "Tổng đã khớp. Có thể lưu hóa đơn." : "Amounts match the bill total. Ready to save.")

                : (vi ? "Chưa thể lưu: tổng tiền từng người phải đúng bằng tổng hóa đơn." : "Cannot save yet: participant amounts must equal the bill total.")}

            </p>

          </div>

        )}

        <button disabled={!ready || busy || !splitPreview?.valid || splitPreview.amounts.length !== count} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">{vi ? "Lưu hóa đơn chia tiền" : "Save split bill"}</button>

      </form>

      <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{vi ? "Sau khi lưu, tạo từng link bằng nút ở mỗi người. Mỗi lần chỉ mở một xác nhận Rabby. Chỉ dùng Arc Testnet." : "Save the bill first, then create one link per participant. Only one Rabby confirmation at a time. Arc Testnet only."}</p>

    </section>

    {bills.map(bill=>{

      const paidRaw = bill.members.filter(m=>m.status==="paid").reduce((sum,m)=>sum+BigInt(m.amountRaw),0n);

      const created = bill.members.filter(m=>m.status==="unpaid" || m.status==="paid").length;

      return <section key={bill.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">

        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">{bill.title}</h3><p className="text-xs text-slate-500">{new Date(bill.createdAt).toLocaleString(vi?"vi-VN":"en-US")}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className={btn} disabled={busy || !ready} onClick={()=>void refreshBill(bill)}><RefreshCw size={15} className="mr-1 inline"/>{vi ? "Đối soát tất cả chưa trả" : "Verify all unpaid"}</button><button type="button" className={btn} disabled={busy || !ready} onClick={()=>void refreshBill(bill, true)}>{vi ? "Kiểm tra cả đã trả" : "Full recheck"}</button>{busy && verifyProgress?.billId === bill.id && <button type="button" className={btn} onClick={()=>{verifyStopRef.current = true;}}>{vi ? "Tạm dừng" : "Pause"}</button>}</div></div>

        <p className="mt-3 text-sm">{vi ? "Đã thu" : "Paid"}: <strong className="text-emerald-600">{currency(paidRaw.toString())} / {currency(bill.totalRaw)} USDC</strong> · {vi ? "Đã trả" : "Paid members"}: {bill.members.filter(m=>m.status === "paid").length}/{bill.members.length} · {vi ? "Chưa trả" : "Unpaid"}: {bill.members.filter(m=>m.status === "unpaid").length} · {vi ? "Đã tạo link" : "Links created"}: {created}/{bill.members.length}</p>

        <p className="mt-1 text-xs text-slate-500">{vi ? "Trạng thái đã lưu có thể cũ. Đối soát sẽ kiểm tra link chưa trả, bỏ qua link đã Paid. Chọn Kiểm tra cả đã trả nếu muốn kiểm tra lại toàn bộ." : "Cached status may be stale. Verify checks outstanding links, skipping Paid. Use Full recheck to audit all."}</p>

        {verifyProgress?.billId === bill.id && <div role="status" aria-live="polite" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"><p>{verifyProgress.status}</p><p className="mt-1 text-xs">{vi ? "Đã xác minh" : "Verified"}: {verifyProgress.checked}/{verifyProgress.total}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700"><div className="h-full bg-blue-600 transition-all" style={{ width: `${verifyProgress.total ? Math.round(verifyProgress.done / verifyProgress.total * 100) : 100}%` }}/></div></div>}

        <div className="mt-4 space-y-3">{bill.members.map(member=>{

          const url = typeof window === "undefined" ? "" : `${window.location.origin}/pay/onchain/${member.id}`;

          const pending = member.status === "confirming";

          const verified = member.status === "unpaid" || member.status === "paid";

          return <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <input

                aria-label={vi ? "Tên người tham gia" : "Participant name"}

                type="text"

                maxLength={60}

                value={member.label}

                onChange={(event) => rename(bill, member, event.target.value)}

                onBlur={() => { if (!member.label.trim()) rename(bill, member, vi ? "Chưa đặt tên" : "Unnamed"); }}

                className="w-44 max-w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"

              />

              <strong className="text-sm">{currency(member.amountRaw)} USDC</strong>

            </div>

            <p className="mt-1 text-xs text-slate-500">{member.status === "paid" ? (vi ? "Đã thanh toán" : "Paid") : member.status === "unpaid" ? (vi ? "Chưa thanh toán" : "Unpaid") : pending ? (vi ? "Có Tx hash, chờ xác nhận" : "Tx hash pending verification") : member.status === "creating" ? (vi ? "Chưa tạo link" : "Not created") : (vi ? "Cần kiểm tra trước khi tạo lại" : "Verify before retry")}</p>{member.error && <p className="max-w-lg break-all text-xs text-amber-600">{member.error}</p>}</div><div className="flex flex-wrap gap-2">{!verified && <button type="button" className={btn} disabled={busy || !ready} onClick={() => void createMemberLink(bill, member)}>{busy ? (vi ? "Đang xử lý" : "Working") : member.hash ? (vi ? "Kiểm tra giao dịch" : "Check transaction") : (vi ? "Tạo link" : "Create link")}</button>}<button type="button" className={btn} disabled={!verified} onClick={()=>{void navigator.clipboard.writeText(url).then(()=>toast.success(vi?"Đã sao chép":"Copied"));}}><Copy size={15} className="inline"/> {vi?"Copy":"Copy"}</button>{verified && <a className={btn} href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} className="inline"/> Link</a>}{member.status==="paid" && <CheckCircle2 className="text-emerald-500"/>}</div></div>;

        })}</div>

      </section>;

    })}

  </div>;

}
