"use client";

import { useEffect, useState } from "react";
import { DIRECTORY_CHANGED_EVENT, TELEGRAM_API_BASE, clearTelegramToken, getTelegramToken, saveTelegramToken, telegramApi, syncBill, getContacts, type DirectoryContact } from "@/lib/telegramDirectory";
import { toast } from "sonner";
import { Send, ShieldCheck } from "lucide-react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { BATCH_CONTRACT_ADDRESS } from "@/lib/web3/batchPaymentLinks";

const BASE = TELEGRAM_API_BASE;
type Member = { id: string; name: string; raw: string; directoryId?: string | null };
type Bill = { id: string; title: string; creator: string; totalRaw: string; txHash: string; stage: string; members: Member[] };

function savedBills(owner: string): Bill[] {
  const key = `flowusd:batch-bills:v1:${BATCH_CONTRACT_ADDRESS.toLowerCase()}:${owner.toLowerCase()}`;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((bill): bill is Bill => Boolean(bill && typeof bill === "object" &&
      bill.creator?.toLowerCase() === owner.toLowerCase() && bill.stage === "confirmed" &&
      /^0x[0-9a-f]{64}$/i.test(bill.txHash) && Array.isArray(bill.members)));
  } catch { return []; }
}

export default function TelegramSyncCard() {
  const wallet = useWeb3Wallet();
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(0);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [enrollCode, setEnrollCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [editingId,setEditingId] = useState("");
  const [editName,setEditName] = useState("");
  const [editFull,setEditFull] = useState("");
  async function saveContact() {
    const owner=wallet.address;
    if(!owner || !editingId || !getTelegramToken(owner) || !editName.trim()) return;
    setDirectoryBusy(true);
    try {
      await telegramApi(`/api/directory/${encodeURIComponent(editingId)}`,"PATCH",{displayName:editName.trim(),fullName:editFull.trim()},getTelegramToken(owner));
      setEditingId("");await reloadDirectory();toast.success("Member name updated");
    } catch(error){setStatus(error instanceof Error ? error.message : String(error));}
    finally{setDirectoryBusy(false);}
  }
  const connected = !!wallet.address && !!getTelegramToken(wallet.address);
  async function reloadDirectory() {
    if (!wallet.address) return;
    try {
      const list = await getContacts(wallet.address);
      setContacts(list);
      window.dispatchEvent(new Event(DIRECTORY_CHANGED_EVENT));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setStatus(text);
      if (/401|expired/i.test(text)) {clearTelegramToken(wallet.address);setToken("");}
    }
  }
  async function addContact() {
    const owner=wallet.address;
    if (!owner || !getTelegramToken(owner) || !enrollCode.trim() || !displayName.trim()) return;
    setDirectoryBusy(true);
    try {
      await telegramApi("/api/directory", "POST", {code:enrollCode.trim(), displayName:displayName.trim(), fullName:fullName.trim()},getTelegramToken(owner));
      setEnrollCode("");setDisplayName("");setFullName("");
      setStatus("Member registered! Choose them when creating the next bill.");
      toast.success("Member added to directory");
      await reloadDirectory();
    } catch (error) {setStatus(error instanceof Error ? error.message : String(error));toast.error("Could not register member");}
    finally {setDirectoryBusy(false);}
  }
  useEffect(() => {
    setToken(wallet.address ? getTelegramToken(wallet.address) : ""); setStatus(""); setContacts([]);
    if (wallet.address && getTelegramToken(wallet.address)) void reloadDirectory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address]);

  async function renewSession() {
    const owner=wallet.address;
    if (!owner || !wallet.provider || !wallet.isOnArcTestnet) return;
    setBusy(true);
    try {
      const challenge=await telegramApi("/api/owner/challenge","POST",{wallet:owner});
      const signature=await wallet.provider.request({method:"personal_sign",params:[challenge.message,owner]});
      if (typeof signature!=="string") throw new Error("Wallet returned no signature");
      const result=await telegramApi("/api/owner/connect","POST",{wallet:owner,nonce:challenge.nonce,signature});
      saveTelegramToken(owner,result.accessToken,result.expiresIn);
      setToken(result.accessToken);
      setStatus("Wallet session renewed. Registered members remain saved; no Telegram re-registration needed.");
      await reloadDirectory();
    } catch(error){setStatus(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  async function connect() {
    if (!BASE || !wallet.provider || !wallet.address || !wallet.isOnArcTestnet || !code.trim()) return;
    setBusy(true);
    try {
      const address = wallet.address;
      const challenge = await telegramApi("/api/challenge", "POST", { wallet: address, code: code.trim() });
      const signature = await wallet.provider.request({
        method: "personal_sign", params: [challenge.message, address],
      });
      if (typeof signature !== "string") throw new Error("Wallet returned no signature");
      const result = await telegramApi("/api/connect", "POST", {
        wallet: address, code: code.trim(), nonce: challenge.nonce, signature,
      });
      saveTelegramToken(address, result.accessToken, result.expiresIn);
      setToken(result.accessToken);
      setCode("");
      await reloadDirectory();
      setStatus("Telegram linked! Press Sync All to import confirmed on-chain bills.");
      toast.success("Telegram wallet linked");
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      setStatus(err); toast.error(err);
    } finally { setBusy(false); }
  }

  async function syncAll() {
    if (!wallet.address || !getTelegramToken(wallet.address) || busy) return;
    setBusy(true);
    const bills = savedBills(wallet.address);
    let ok = 0;
    let fails = 0;
    try {
      if (!bills.length) { setStatus("No confirmed local Batch bills found for this wallet."); return; }
      for (let i = 0; i < bills.length; i++) {
        setStatus(`Syncing ${i + 1}/${bills.length}: ${bills[i].title}`);
        try {
          await syncBill(wallet.address, bills[i]);
          ok++;
        } catch (error) {
          fails++;
          setStatus(`Error on ${bills[i].title}: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof Error && /Reconnect|401/.test(error.message)) break;
        }
      }
      setCount(ok);
      if (!fails) {setStatus(`Synced ${ok} confirmed bills. Open Telegram and type /status.`);toast.success(`${ok} bills synced`);}
      else setStatus(`Synced ${ok}, failed ${fails}. Review the backend output and try again.`);
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 text-lg font-bold"><Send size={18}/> Telegram Payment Monitor — Phase 1</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pair your Telegram with this wallet, then securely import verified Batch bills into the bot. No private keys or gas transactions required for syncing.</p>
      {!BASE ? <p className="mt-3 text-sm text-amber-600">Set NEXT_PUBLIC_FLOWUSD_BOT_API_URL in .env.local and restart Next.js.</p> :
        <>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <li>Open your Telegram bot, send /start then /connect in private chat.</li>
            <li>Paste its pairing code below, click Link Telegram and sign the message in Rabby.</li>
            <li>Click Sync All. The backend checks all link IDs against the confirmed Arc receipt.</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="One-time /connect code" autoComplete="off" aria-label="Telegram pairing code" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
            <button type="button" onClick={() => void connect()} disabled={busy || !wallet.address || !wallet.provider || !wallet.isOnArcTestnet || !code.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Link Telegram</button>
            <button type="button" onClick={()=>void renewSession()} disabled={busy || !wallet.address || !wallet.provider || !wallet.isOnArcTestnet} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Renew wallet session</button>
            <button type="button" onClick={() => void syncAll()} disabled={busy || !connected} className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-600 disabled:opacity-50">Sync All</button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <h4 className="font-semibold text-sm">Member Directory — register once, use for every bill</h4>
            <p className="mt-1 text-xs text-slate-500">Members open the same Telegram bot, send /start then /register, and privately give you their one-time registration code. Only you can add contacts to your directory.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={enrollCode} onChange={e=>setEnrollCode(e.target.value)} placeholder="Member /register code" aria-label="Member registration code" className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display name (e.g. Huy)" aria-label="Display name" maxLength={60} className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name (optional)" aria-label="Full name" maxLength={120} className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              <button type="button" disabled={!connected || directoryBusy || !enrollCode.trim() || !displayName.trim()} onClick={()=>void addContact()} className="rounded-lg bg-emerald-600 p-2 text-sm font-semibold text-white disabled:opacity-50">{directoryBusy ? "Registering..." : "Add member — one time"}</button>
            </div>
            <div className="mt-3 flex justify-between gap-2 text-xs"><span>Saved members: <strong>{contacts.length}</strong></span><button type="button" disabled={!connected} onClick={()=>void reloadDirectory()} className="text-blue-600 underline disabled:opacity-50">Refresh directory</button></div>
            {contacts.length > 0 && <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{contacts.map(c=><div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800" key={c.id}>
               {editingId===c.id ? <div className="flex flex-wrap gap-2"><input aria-label="Update display name" maxLength={60} value={editName} onChange={e=>setEditName(e.target.value)} className="min-w-0 flex-1 rounded border p-1 dark:bg-slate-700"/><input aria-label="Update full name" maxLength={120} value={editFull} onChange={e=>setEditFull(e.target.value)} className="min-w-0 flex-1 rounded border p-1 dark:bg-slate-700"/><button type="button" disabled={directoryBusy||!editName.trim()} onClick={()=>void saveContact()} className="text-emerald-600 underline disabled:opacity-50">Save</button><button type="button" onClick={()=>setEditingId("")} className="underline">Cancel</button></div>
               : <div className="flex justify-between gap-2"><span><strong>{c.display_name}</strong>{c.full_name ? ` — ${c.full_name}` : ""}{c.username ? ` (@${c.username})` : ""}</span><button type="button" className="shrink-0 text-blue-600 underline" onClick={()=>{setEditingId(c.id);setEditName(c.display_name);setEditFull(c.full_name||"");}}>Edit</button></div>}
              </div>)}</div>}
          </div>
          {status && <p role="status" className="mt-3 break-words rounded-lg bg-slate-100 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">{status}</p>}
          {count > 0 && <p className="mt-2 text-xs text-emerald-600">{count} bills linked to your wallet.</p>}
        </>}
      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={14}/> Telegram never receives wallet secrets. Messages are signed, not blockchain transactions.</p>
    </section>
  );
}
