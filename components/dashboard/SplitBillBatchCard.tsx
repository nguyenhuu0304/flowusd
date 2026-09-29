"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Layers3, RefreshCcw } from "lucide-react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import TelegramSyncCard from "@/components/dashboard/TelegramSyncCard";
import { DIRECTORY_CHANGED_EVENT, getContacts, getTelegramToken, syncBill, type DirectoryContact } from "@/lib/telegramDirectory";
import { useAppearance } from "@/contexts/AppearanceContext";
import { generateOnChainLinkId } from "@/lib/web3/paymentLinksAbi";
import { formatUnits } from "@/lib/web3/erc20";
import { BATCH_CONTRACT_ADDRESS, batchIsConfigured, readBatchLink, submitBatch, waitForBatchReceipt } from "@/lib/web3/batchPaymentLinks";
import { explorerTxUrl } from "@/lib/web3/config";
import type { Eip1193Provider } from "@/lib/web3/provider";

type Member = { id: string; name: string; raw: string; status: "pending" | "unpaid" | "paid"; payer?: string; directoryId?: string | null };
type BatchBill = { id: string; creator: string; title: string; createdAt: string; totalRaw: string; members: Member[]; txHash: string; stage: "prepared" | "submitted" | "confirmed" | "needs_review" };
const addr = /^0x[a-fA-F0-9]{40}$/;
const token = (amount: string) => formatUnits(BigInt(amount), 6);
const idPattern = /^0x[a-fA-F0-9]{64}$/;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function parseTotal(value: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim())) throw new Error("Invalid USDC amount; maximum 6 decimals.");
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0");
}
function key(owner: string) { return `flowusd:batch-bills:v1:${BATCH_CONTRACT_ADDRESS.toLowerCase()}:${owner.toLowerCase()}`; }
function load(owner: string): BatchBill[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(owner)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is BatchBill => !!v && typeof v === "object" && v.creator?.toLowerCase() === owner.toLowerCase() && Array.isArray(v.members));
  } catch { return []; }
}
function write(owner: string, bills: BatchBill[]) { localStorage.setItem(key(owner), JSON.stringify(bills)); }
function rpcError(error: unknown) { return error instanceof Error ? error.message : String(error); }
function isLimit(error: unknown) { return /429|rate.limit|request exceeds|too many|limit exceeded|-32005/i.test(rpcError(error)); }
const btn = "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600";

export default function SplitBillBatchCard() {
  const wallet = useWeb3Wallet();
  const { language } = useAppearance();
  const vi = language === "vi";
  const owner = wallet.address;
  const provider = wallet.provider;
  const ready = !!owner && !!provider && wallet.isOnArcTestnet && batchIsConfigured();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState(3);
  const [names, setNames] = useState<string[]>([]);
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [bills, setBills] = useState<BatchBill[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [progress, setProgress] = useState("");
  const groupSize = useMemo(() => Number.isInteger(people) && people >= 2 && people <= 100 ? people : 0, [people]);
  const validTotal = useMemo(() => {
    try { const raw = parseTotal(amount); return groupSize > 0 && raw >= BigInt(groupSize) ? raw : null; }
    catch { return null; }
  }, [amount, groupSize]);
  useEffect(() => { setBills(owner ? load(owner) : []); setProgress(""); setChosenIds([]); }, [owner]);
  useEffect(() => {
    let live = true;
    const update = () => {
      if (!owner || !getTelegramToken(owner)) {if(live) setContacts([]);return;}
      void getContacts(owner).then(items => {if(live)setContacts(items);}).catch(() => {if(live)setContacts([]);});
    };
    update();
    window.addEventListener(DIRECTORY_CHANGED_EVENT,update);
    return () => {live=false;window.removeEventListener(DIRECTORY_CHANGED_EVENT,update);};
  }, [owner]);
  const setName = (index: number, value: string) => {
    const normalized = value.trim().toLocaleLowerCase();
    const matches = normalized ? contacts.filter(c => c.display_name.toLocaleLowerCase() === normalized || c.full_name.toLocaleLowerCase() === normalized || (c.username || "").toLocaleLowerCase() === normalized.replace(/^@/, "")) : [];
    setNames(old => {const next=[...old];next[index]=value;return next;});
    setChosenIds(old => {const next=[...old];next[index]=matches.length===1 ? matches[0].id : "";return next;});
  };
  const chooseName = (index: number, id: string) => {
    const match=contacts.find(c=>c.id===id);
    setChosenIds(old=>{const next=[...old];next[index]=id;return next;});
    if(match)setNames(old=>{const next=[...old];next[index]=match.display_name;return next;});
  };
  const saveBill = useCallback((address: string, bill: BatchBill) => {
    const next = load(address).map(b => b.id === bill.id ? bill : b);
    if (!next.some(b => b.id === bill.id)) next.unshift(bill);
    write(address, next); setBills(next);
  }, []);
  const modifyMember = useCallback((billId: string, memberId: string, patch: Partial<Member>) => {
    if (!owner) return;
    const next = load(owner).map(b => b.id === billId ? { ...b, members: b.members.map(m => m.id === memberId ? { ...m, ...patch } : m) } : b);
    write(owner, next); setBills(next);
  }, [owner]);
  function makeBill(address: string): BatchBill {
    if (validTotal === null || !groupSize) throw new Error("Enter a positive amount and 2-100 people.");
    const base = validTotal / BigInt(groupSize);
    const extra = Number(validTotal % BigInt(groupSize));
    const used=chosenIds.slice(0,groupSize).filter(Boolean);
    if (used.length !== new Set(used).size) throw new Error("Each Telegram member can appear only once in a bill.");
    const members: Member[] = Array.from({ length: groupSize }, (_, i) => ({
      id: generateOnChainLinkId(),
      name: names[i]?.trim().slice(0, 60) || (vi ? `Người ${i + 1}` : `Person ${i + 1}`),
      raw: (base + (i < extra ? 1n : 0n)).toString(),
      status: "pending",
      directoryId: chosenIds[i] || null,
    }));
    return { id: generateOnChainLinkId(), creator: address, title: title.trim().slice(0, 80) || (vi ? "Chia hóa đơn" : "Split bill"), createdAt: new Date().toISOString(), totalRaw: validTotal.toString(), members, stage: "prepared", txHash: "" };
  }
  async function createAll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !owner || !provider || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    let bill: BatchBill | null = null;
    try {
      bill = makeBill(owner);
      // Persist IDs BEFORE presenting a wallet signature. Do not generate a new set on retry.
      saveBill(owner, bill);
      setProgress(vi ? "Đang chờ một xác nhận Rabby..." : "Waiting for one Rabby confirmation...");
      const hash = await submitBatch(provider, owner, bill.members.map(m => m.id), bill.members.map(m => BigInt(m.raw)));
      if (!idPattern.test(hash)) throw new Error("Wallet returned an invalid transaction hash.");
      bill = { ...bill, txHash: hash, stage: "submitted" };
      saveBill(owner, bill);
      setProgress(vi ? "Đang chờ blockchain xác nhận giao dịch hàng loạt..." : "Waiting for the batch transaction to confirm...");
      await waitForBatchReceipt(provider, hash);
      bill = { ...bill, stage: "confirmed", members: bill.members.map(m => ({ ...m, status: "unpaid" as const })) };
      saveBill(owner, bill);
      toast.success(vi ? `Đã tạo ${bill.members.length} liên kết trong một giao dịch!` : `${bill.members.length} links created in one transaction!`);
      setTitle(""); setAmount(""); setNames([]); setChosenIds([]);
      if (getTelegramToken(owner)) {
        try {
          setProgress("Syncing confirmed batch to Telegram and sending member requests...");
          await syncBill(owner, bill);
          setProgress("Telegram synced. Registered members will receive their individual payment links.");
          toast.success("Telegram sync completed");
        } catch (syncError) {
          setProgress("Blockchain confirmed. Telegram sync needs retry: " + rpcError(syncError));
          toast.error("Payment links created, but Telegram sync failed. Use Sync All.");
        }
      } else {
        setProgress("Links confirmed. To send Telegram notifications, pair admin wallet via /connect then use Sync All.");
      }
    } catch (error) {
      if (bill) saveBill(owner, { ...bill, stage: bill.txHash ? "submitted" : "needs_review" });
      setProgress(vi ? "Đã lưu dữ liệu. Kiểm tra blockchain trước khi gửi lại; không tự động ký lần hai." : "Saved. Reconcile on-chain before sending again; never auto-resubmit.");
      toast.error(rpcError(error));
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function reconcile(billId: string, verifyPaid = false) {
    if (!ready || !owner || !provider || busyRef.current) return;
    const original = load(owner).find(b => b.id === billId);
    if (!original) return;
    busyRef.current = true; setBusy(true);
    try {
      if (original.txHash && original.stage !== "confirmed") {
        await waitForBatchReceipt(provider, original.txHash);
      }
      const members = [...original.members];
      for (let i = 0; i < members.length; i++) {
        if (!verifyPaid && original.stage === "confirmed" && members[i].status === "paid") continue;
        let chain;
        try { chain = await readBatchLink(provider, members[i].id); }
        catch (error) {
          if (isLimit(error)) { setProgress(vi ? `RPC giới hạn tại ${i}/${members.length}; kết quả trước đó đã lưu.` : `RPC limited at ${i}/${members.length}; prior results saved.`); return; }
          throw error;
        }
        if (chain.creator.toLowerCase() !== owner.toLowerCase() || chain.amount !== BigInt(members[i].raw)) {
          if (chain.creator.toLowerCase() === "0x0000000000000000000000000000000000000000") {
            // A missing link is not proof the entire batch failed; leave pending.
            setProgress(vi ? "Chưa thấy link trên chain. Kiểm tra Tx trước khi gửi lại." : "Link not found on-chain. Inspect Tx before resubmitting.");
            return;
          }
          throw new Error("On-chain recipient/amount mismatch; verification stopped.");
        }
        members[i] = { ...members[i], status: chain.paid ? "paid" : "unpaid", payer: chain.payer };
        saveBill(owner, { ...original, stage: "confirmed", members: [...members] });
        setProgress(`${i + 1}/${members.length}`);
        if (i < members.length - 1) await sleep(400);
      }
      setProgress(vi ? "Đã đối soát xong." : "All links verified.");
    } catch (error) { setProgress(rpcError(error)); toast.error(rpcError(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Layers3 size={19}/>{vi ? "Tạo tất cả Payment Links trong một giao dịch" : "Batch Create — one transaction"}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{vi ? "Chia đều một hóa đơn, đặt tên người tham gia rồi bấm Create All. Hợp đồng mới không làm ảnh hưởng các link cũ." : "Split a total, name people and Create All with one transaction. Existing links stay unchanged."}</p>
      {!batchIsConfigured() && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">{vi ? "Chưa cấu hình hợp đồng Batch. Triển khai FlowUSDBatchPaymentLinks.sol và đặt NEXT_PUBLIC_BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS trước khi sử dụng." : "Deploy batch contract and set NEXT_PUBLIC_BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS first."}</p>}
      <form onSubmit={e => void createAll(e)} className="mt-4 space-y-3">
        <label className="block text-sm font-medium">{vi ? "Tên hóa đơn" : "Bill title"}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" placeholder="Lunch" /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{vi ? "Tổng (USDC)" : "Total (USDC)"}<input value={amount} onChange={e => setAmount(e.target.value)} placeholder="9" required inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="block text-sm font-medium">{vi ? "Số người (2–100)" : "People (2–100)"}<input type="number" min={2} max={100} value={people} onChange={e => setPeople(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800" /></label>
        </div>
        {groupSize > 0 && <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">{Array.from({ length: groupSize }, (_, i) => <div key={i} className="text-xs"><label>{vi ? "Người" : "Person"} {i + 1}<input maxLength={60} value={names[i] || ""} onChange={e => setName(i,e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800" placeholder={`Name ${i + 1}`} /></label>
          <select aria-label={`Telegram member ${i+1}`} value={chosenIds[i] || ""} onChange={e=>chooseName(i,e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs dark:border-slate-600 dark:bg-slate-800">
            <option value="">— No Telegram member selected —</option>
            {contacts.filter(c=>!names[i]?.trim() || (c.display_name+' '+c.full_name+' '+(c.username||'')).toLocaleLowerCase().includes(names[i].trim().toLocaleLowerCase()) || c.id===chosenIds[i]).map(c=><option key={c.id} value={c.id}>{c.display_name}{c.full_name ? ` · ${c.full_name}` : ''}{c.username ? ` (@${c.username})` : ''}</option>)}
          </select>
          {chosenIds[i] ? <p className="mt-1 text-emerald-600">✓ Telegram registered</p> : <p className="mt-1 text-amber-600">Not linked to Telegram — payment link only</p>}
        </div>)}</div>}
        <p className="text-xs text-slate-500">Type a saved member name or choose from the dropdown. A registered member receives notifications automatically after the confirmed batch is synced.</p>
        {validTotal !== null && <p className="text-xs text-blue-600 dark:text-blue-300">{vi ? "Mỗi người khoảng" : "Each person about"} {token((validTotal / BigInt(groupSize)).toString())} USDC; {vi ? "tổng chia chính xác 6 chữ số thập phân." : "exact total to 6 decimals."}</p>}
        <button type="submit" disabled={!ready || busy || validTotal === null} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? (vi ? "Đang xử lý..." : "Working...") : "Create All — 1 Transaction"}</button>
      </form>
      {progress && <p role="status" className="mt-3 break-all rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">{progress}</p>}
      <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{vi ? "Chỉ dùng Arc Testnet. Một giao dịch tạo tối đa 100 link nếu gas limit cho phép. Nếu Rabby lỗi, không gửi lại trước khi đối soát." : "Arc Testnet only. Up to 100 links per transaction if gas permits. Never blindly resend after wallet error."}</p>
    </section>
    <TelegramSyncCard />
    {bills.map(b => {
      const paid = b.members.filter(m => m.status === "paid");
      const received = paid.reduce((x, m) => x + BigInt(m.raw), 0n);
      return <section key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{b.title}</h3><p className="mt-1 break-all text-[11px] text-slate-500">Bill ID: {b.id} <button type="button" className="ml-1 underline" onClick={() => void navigator.clipboard.writeText(b.id).then(() => toast.success("Bill ID copied"))}>Copy ID</button></p><p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString(vi ? "vi-VN" : "en-US")} · {b.stage}</p></div><div className="flex gap-2"><button type="button" disabled={!ready || busy} onClick={() => void reconcile(b.id)} className={btn}><RefreshCcw size={14} className="mr-1 inline"/>{vi ? "Verify All" : "Verify All"}</button><button type="button" disabled={!ready || busy} onClick={() => void reconcile(b.id, true)} className={btn}>{vi ? "Kiểm tra toàn bộ" : "Full Recheck"}</button></div></div>
        <p className="mt-3 text-sm">{vi ? "Đã thu" : "Received"}: <strong className="text-emerald-600">{token(received.toString())}/{token(b.totalRaw)} USDC</strong> · {vi ? "Đã trả" : "Paid"} {paid.length}/{b.members.length}</p>
        {b.txHash && <p className="mt-2 text-xs"><a href={explorerTxUrl(b.txHash)} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">{vi ? "Xem giao dịch tạo hàng loạt" : "View batch creation Tx"} ↗</a></p>}
        {!b.txHash && b.stage === "needs_review" && <p className="mt-2 text-xs text-amber-600">{vi ? "Ví không trả mã giao dịch. Kiểm tra Explorer trước khi thử tạo lại; không tự động tạo link mới." : "Wallet returned no Tx hash. Check explorer before retrying; no auto-resubmit."}</p>}
        <div className="mt-4 space-y-2">{b.members.map(m => {
          const link = typeof window !== "undefined" ? `${window.location.origin}/pay/split/${m.id}` : "";
          return <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><input aria-label="Participant name" value={m.name} maxLength={60} onChange={e => modifyMember(b.id, m.id, { name: e.target.value })} className="w-40 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"/><strong>{token(m.raw)} USDC</strong>
          {contacts.length > 0 && <select aria-label="Assign Telegram contact for existing link" value={m.directoryId || ""} disabled={!!m.directoryId} onChange={e=>{const match=contacts.find(c=>c.id===e.target.value);modifyMember(b.id,m.id,{directoryId:e.target.value||null,...(match?{name:match.display_name}:{})});}} className="max-w-48 rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800"><option value="">Telegram: not assigned</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.display_name}{c.username ? ` (@${c.username})` : ""}</option>)}</select>}</div><p className="mt-1 text-xs text-slate-500">{m.status === "paid" ? (vi ? "Đã thanh toán" : "Paid") : m.status === "unpaid" ? (vi ? "Chưa thanh toán" : "Unpaid") : (vi ? "Đang chờ xác minh" : "Pending verification")}</p>{m.payer && m.status === "paid" && <p className="break-all text-xs text-slate-500">Payer: {m.payer}</p>}</div><button type="button" className={btn} disabled={b.stage !== "confirmed"} onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Copied"))}><Copy size={14} className="inline"/> Copy</button>{b.stage === "confirmed" && <a href={link} target="_blank" rel="noreferrer" className={btn}><ExternalLink size={14} className="inline"/> Link</a>}</div>;
        })}</div>
      </section>;
    })}
  </div>;
}
