"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { BATCH_CONTRACT_ADDRESS, batchIsConfigured, readUsdcAllowance, approveUsdc, payBatchLink, requireArc, waitForBatchReceipt } from "@/lib/web3/batchPaymentLinks";
import { decodeGetLink, encodeGetLink, type OnChainPaymentLink } from "@/lib/web3/paymentLinksAbi";
import { ARC_TESTNET_PARAMS, ARC_TESTNET_CHAIN_ID_HEX, USDC_CONTRACT_ADDRESS, USDC_DECIMALS, explorerTxUrl, explorerAddressUrl } from "@/lib/web3/config";
import { formatUnits } from "@/lib/web3/erc20";
import type { Eip1193Provider } from "@/lib/web3/provider";

const rpcUrl = "https://rpc.testnet.arc.network";
const zero = "0x0000000000000000000000000000000000000000";
const idRegex = /^0x[a-fA-F0-9]{64}$/;
async function publicLink(id: string): Promise<OnChainPaymentLink> {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: BATCH_CONTRACT_ADDRESS, data: encodeGetLink(id) }, "latest"] }) });
  if (!response.ok) throw new Error(`Arc Testnet RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: string; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || "Arc RPC error");
  if (!payload.result || payload.result.length !== 322) throw new Error("Invalid contract response");
  return decodeGetLink(payload.result);
}
async function walletProvider(): Promise<Eip1193Provider> {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("Please open the link in a browser with Rabby or MetaMask.");
  return window.ethereum;
}
export default function PaySplitPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<OnChainPaymentLink | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payer, setPayer] = useState("");
  const [paymentHash, setPaymentHash] = useState("");
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setWalletAvailable(Boolean(window.ethereum)); }, []);
  async function copyPaymentUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Payment link copied. Open it inside your wallet's DApp browser.");
    } catch {
      toast.error("Copy unavailable. Copy the URL from your browser address bar.");
    }
  }

  const busy = useRef(false);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!batchIsConfigured()) throw new Error("Batch payment contract is not configured on this website.");
      if (!idRegex.test(id)) throw new Error("Invalid payment link ID.");
      const link = await publicLink(id);
      if (link.creator.toLowerCase() === zero) throw new Error("Payment request not found on-chain.");
      setData(link);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  async function connect() {
    try {
      const provider = await walletProvider();
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts?.[0]) throw new Error("No wallet account selected.");
      try { await requireArc(provider); }
      catch {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }] }).catch(async () => {
          await provider.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET_PARAMS] });
        });
        await requireArc(provider);
      }
      setPayer(accounts[0]);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }
  async function pay() {
    if (busy.current || !data || data.paid || !payer) return;
    busy.current = true; setPaying(true);
    try {
      const provider = await walletProvider();
      await requireArc(provider);
      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      if (!accounts?.some(a => a.toLowerCase() === payer.toLowerCase())) throw new Error("Connected wallet changed. Reconnect.");
      const fresh = await publicLink(id);
      if (fresh.paid) { setData(fresh); throw new Error("This link is already paid."); }
      if (fresh.creator.toLowerCase() !== data.creator.toLowerCase() || fresh.amount !== data.amount) throw new Error("Payment request changed. Refresh the page.");
      if (fresh.amount <= 0n) throw new Error("Invalid payment amount.");
      const allowance = await readUsdcAllowance(provider, payer);
      if (allowance < fresh.amount) {
        toast.message("Step 1/2: approve the exact amount of USDC in your wallet.");
        const approveHash = await approveUsdc(provider, payer, fresh.amount);
        await waitForBatchReceipt(provider, approveHash);
      }
      toast.message("Confirm payment in your wallet.");
      const hash = await payBatchLink(provider, payer, id, fresh.amount);
      setPaymentHash(hash);
      await waitForBatchReceipt(provider, hash);
      await reload();
      toast.success("Payment confirmed on Arc Testnet!");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { busy.current = false; setPaying(false); }
  }
  const amount = data ? formatUnits(data.amount, USDC_DECIMALS) : "—";
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><Toaster position="top-center" richColors/>
    <div className="w-full max-w-lg space-y-5"><header className="text-center"><h1 className="text-3xl font-bold text-blue-600">FlowUSD</h1><p className="mt-1 text-sm text-slate-500">Arc Testnet · Split Bill Payment</p></header>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading && <p className="text-center">Reading payment request from Arc Testnet...</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {data && <><div className="text-center"><p className="text-sm text-slate-500">{data.paid ? "Payment completed" : "Payment requested"}</p><p className="mt-2 text-3xl font-bold">{amount} USDC</p><span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${data.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{data.paid ? "Paid" : "Unpaid"}</span></div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800"><p>Recipient: <a href={explorerAddressUrl(data.creator)} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">{data.creator}</a></p><p>Contract: <a href={explorerAddressUrl(BATCH_CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="break-all text-blue-600 underline">{BATCH_CONTRACT_ADDRESS}</a></p><p>Link ID: <span className="break-all font-mono">{id}</span></p>{data.paid && <><p>Payer: <span className="break-all">{data.payer}</span></p><p>Paid at: {new Date(Number(data.paidAt) * 1000).toLocaleString()}</p></>}</div>
          {!data.paid && walletAvailable === false && <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700 dark:border-blue-800 dark:bg-blue-950 dark:text-slate-100">
            <p className="font-semibold">Paying from Telegram on a phone?</p>
            <p>This browser has no wallet connection. Open this exact payment URL in your mobile wallet's built-in DApp browser, then connect and sign there. Do not paste your seed phrase anywhere.</p>
            <button type="button" onClick={() => void copyPaymentUrl()} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{copied ? "Copied · Open in wallet browser" : "Copy link for wallet browser"}</button>
          </div>}
          {!data.paid && <>{!payer ? <button type="button" onClick={() => void connect()} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">Connect wallet on Arc Testnet</button> : <><p className="break-all text-xs text-slate-500">Payer: {payer}</p><button type="button" disabled={paying} onClick={() => void pay()} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{paying ? "Waiting for wallet / confirmation..." : `Pay ${amount} USDC`}</button><p className="text-xs text-slate-500">Wallet may ask for an exact USDC approval first, then payment. Never approve unlimited funds.</p></>}</>}
        </>}
        {paymentHash && <a href={explorerTxUrl(paymentHash)} target="_blank" rel="noreferrer" className="block break-all text-center text-xs text-blue-600 underline">View payment transaction ↗</a>}
        <button type="button" disabled={loading || paying} onClick={() => void reload()} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold disabled:opacity-50 dark:border-slate-600">Refresh payment status</button>
      </section><p className="text-center text-xs text-slate-500">Arc Testnet only. Never share private keys or recovery phrases.</p>
    </div>
  </main>;
}
