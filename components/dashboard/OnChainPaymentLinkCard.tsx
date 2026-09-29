
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, ShieldCheck, Wallet2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import {
  approveUsdcForPaymentLinks,
  createLinkOnChain,
  generateOnChainLinkId,
  getLinkOnChain,
  getUsdcAllowance,
  isPaymentLinksContractConfigured,
  payLinkOnChain,
  type OnChainPaymentLink,
} from "@/lib/web3/paymentLinksContract";
import {
  PAYMENT_LINKS_CONTRACT_ADDRESS,
  USDC_DECIMALS,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/web3/config";
import { formatUnits, parseUnits } from "@/lib/web3/erc20";
import { shortenAddress } from "@/lib/utils";

type Receipt = { status?: string; transactionHash?: string } | null;
type Provider = NonNullable<ReturnType<typeof useWeb3Wallet>["provider"]>;

const LINK_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RECEIPT_ATTEMPTS = 45;
const RECEIPT_INTERVAL_MS = 2000;

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForReceipt(provider: Provider, hash: string): Promise<void> {
  for (let attempt = 0; attempt < RECEIPT_ATTEMPTS; attempt++) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as Receipt;

    if (receipt) {
      if (receipt.status === "0x1" || receipt.status === "0x01") return;
      if (receipt.status === "0x0" || receipt.status === "0x00") {
        throw new Error(`Transaction failed on-chain: ${hash}`);
      }
      throw new Error(`Unexpected transaction receipt status for ${hash}`);
    }
    await sleep(RECEIPT_INTERVAL_MS);
  }
  throw new Error(`Transaction not confirmed yet. Check on ArcScan: ${hash}`);
}

function normalizeLinkId(value: string): string {
  const id = value.trim();
  if (!LINK_ID_PATTERN.test(id)) {
    throw new Error("Link ID must contain 0x followed by 64 hexadecimal characters.");
  }
  return id;
}

function validAmount(value: string, allowEmpty: boolean): bigint {
  if (!value.trim() && allowEmpty) return 0n;
  if (!/^(?:\d+)(?:\.\d{1,6})?$/.test(value.trim())) {
    throw new Error("Enter a valid USDC amount (up to 6 decimal places).");
  }
  const amount = parseUnits(value.trim(), USDC_DECIMALS);
  if (amount <= 0n) throw new Error("Amount must be greater than zero.");
  return amount;
}

function exists(link: OnChainPaymentLink): boolean {
  return link.creator.toLowerCase() !== ZERO_ADDRESS;
}

function ErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="mt-3 break-words rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  ) : null;
}

export default function OnChainPaymentLinkCard() {
  const wallet = useWeb3Wallet();
  const [createAmount, setCreateAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLinkId, setCreatedLinkId] = useState<string | null>(null);
  const [createTxHash, setCreateTxHash] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [payLinkId, setPayLinkId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payTxHash, setPayTxHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<OnChainPaymentLink | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("On-chain Link ID copied. Paste it into Look up a link.");
    } catch {
      toast.error("Copy failed. Select and copy the Link ID manually.");
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!wallet.address || !wallet.provider) {
      toast.error("Connect your Arc Testnet wallet first.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    setCreatedLinkId(null);
    setCreateTxHash(null);
    try {
      const amountRaw = validAmount(createAmount, true);
      const id = generateOnChainLinkId();
      const hash = await createLinkOnChain(wallet.provider, wallet.address, id, amountRaw);
      setCreatedLinkId(id);
      setCreateTxHash(hash);
      toast.message("Transaction submitted. Waiting for confirmation...");
      await waitForReceipt(wallet.provider, hash);
      const saved = await getLinkOnChain(wallet.provider, id);
      if (!exists(saved) || saved.creator.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("Transaction confirmed, but the link could not be verified on-chain.");
      }
      setLookupId(id);
      setLookupResult(saved);
      setCreateAmount("");
      toast.success("On-chain payment link confirmed!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create link.";
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!wallet.provider) {
      toast.error("Connect your Arc Testnet wallet first.");
      return;
    }
    setLookingUp(true);
    setLookupResult(null);
    setLookupError(null);
    try {
      const id = normalizeLinkId(lookupId);
      const result = await getLinkOnChain(wallet.provider, id);
      if (!exists(result)) {
        throw new Error("Link not found on this contract/network. Use the on-chain Link ID, not an API link ID or a transaction hash.");
      }
      setLookupResult(result);
      toast.success("Payment link found on-chain.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed.";
      setLookupError(message);
      toast.error(message);
    } finally {
      setLookingUp(false);
    }
  }

  async function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!wallet.address || !wallet.provider) {
      toast.error("Connect your Arc Testnet wallet first.");
      return;
    }
    setPaying(true);
    setPayError(null);
    setPayTxHash(null);
    try {
      const id = normalizeLinkId(payLinkId);
      const link = await getLinkOnChain(wallet.provider, id);
      if (!exists(link)) throw new Error("Payment link does not exist on this contract/network.");
      if (link.paid) throw new Error("This payment link has already been paid.");
      const amountRaw = link.amount > 0n ? link.amount : validAmount(payAmount, false);
      if (amountRaw <= 0n) throw new Error("Payment amount must be greater than zero.");
      const allowance = await getUsdcAllowance(wallet.provider, wallet.address);
      if (allowance < amountRaw) {
        toast.message("Approve the exact required USDC amount in your wallet.");
        const approvalHash = await approveUsdcForPaymentLinks(
          wallet.provider,
          wallet.address,
          amountRaw
        );
        toast.message("Waiting for USDC approval confirmation...");
        await waitForReceipt(wallet.provider, approvalHash);
        const updatedAllowance = await getUsdcAllowance(wallet.provider, wallet.address);
        if (updatedAllowance < amountRaw) {
          throw new Error("USDC allowance is still insufficient after approval.");
        }
      }
      const latest = await getLinkOnChain(wallet.provider, id);
      if (!exists(latest) || latest.paid) {
        throw new Error("Payment link is no longer available.");
      }
      toast.message("Confirm the USDC payment transaction in your wallet.");
      const hash = await payLinkOnChain(wallet.provider, wallet.address, id, amountRaw);
      setPayTxHash(hash);
      toast.message("Payment submitted. Waiting for confirmation...");
      await waitForReceipt(wallet.provider, hash);
      const settled = await getLinkOnChain(wallet.provider, id);
      if (!settled.paid) throw new Error("Payment transaction confirmed, but link status is not paid.");
      setLookupId(id);
      setLookupResult(settled);
      toast.success("USDC payment confirmed on-chain!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed.";
      setPayError(message);
      toast.error(message);
    } finally {
      setPaying(false);
    }
  }

  if (!isPaymentLinksContractConfigured()) {
    return (
      <Card className="p-8">
        <h2 className="text-xl font-bold text-slate-900">On-chain Registry (Arc Testnet)</h2>
        <p className="mt-3 text-sm text-slate-500">
          Configure NEXT_PUBLIC_PAYMENT_LINKS_CONTRACT_ADDRESS in .env.local first.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={20} className="text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">On-chain Registry (Arc Testnet)</h2>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        This registry uses an on-chain Link ID (bytes32), separate from the app's API payment links. Contract:{" "}
        <a
          href={explorerAddressUrl(PAYMENT_LINKS_CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-blue-600 underline"
        >
          {shortenAddress(PAYMENT_LINKS_CONTRACT_ADDRESS)}
        </a>
      </p>

      {wallet.needsWalletSelection ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="mb-4 text-center text-slate-600">Choose a wallet to use:</p>
          <div className="space-y-3">
            {wallet.wallets.map((w) => (
              <button
                key={w.uuid}
                type="button"
                onClick={() => wallet.connectWith(w).catch((e) => toast.error(e.message))}
                disabled={wallet.connecting}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
              >
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.icon} alt="" className="h-6 w-6 rounded" />
                ) : (
                  <Wallet2 size={20} className="text-blue-600" />
                )}
                <span>{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : !wallet.address ? (
        <Button onClick={() => wallet.connect().catch((e) => toast.error(e.message))}>
          {wallet.connecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleCreate} className="space-y-3 border-b border-slate-100 pb-6">
            <h3 className="font-semibold text-slate-900">1. Create an on-chain payment link</h3>
            <Input
              type="number"
              min="0"
              step="0.000001"
              value={createAmount}
              onChange={(e) => setCreateAmount(e.target.value)}
              placeholder="USDC amount (leave empty for any amount)"
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Waiting for confirmation..." : "Create On-Chain"}
            </Button>
            {createdLinkId && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <p className="font-medium text-slate-900">Your on-chain Link ID:</p>
                <code className="block select-all break-all text-slate-700">{createdLinkId}</code>
                <Button type="button" variant="outline" onClick={() => handleCopyId(createdLinkId)}>
                  <Copy size={15} /> Copy Link ID
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setLookupId(createdLinkId);
                  setLookupResult(null);
                  setLookupError(null);
                }}>
                  Fill Lookup
                </Button>
                {createTxHash && (
                  <a href={explorerTxUrl(createTxHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 underline">
                    <ExternalLink size={14} /> View creation transaction on ArcScan
                  </a>
                )}
              </div>
            )}
            <ErrorMessage message={createError} />
          </form>

          <form onSubmit={handleLookup} className="space-y-3 border-b border-slate-100 pb-6">
            <h3 className="font-semibold text-slate-900">2. Look up an on-chain link</h3>
            <Input
              type="text"
              value={lookupId}
              onChange={(e) => {
                setLookupId(e.target.value);
                setLookupResult(null);
              }}
              placeholder="Paste on-chain Link ID (0x + 64 hex characters)"
            />
            <Button type="submit" disabled={lookingUp} variant="outline">
              {lookingUp ? "Checking..." : "Check Link"}
            </Button>
            {lookupResult && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                <p>Creator: <code className="break-all">{lookupResult.creator}</code></p>
                <p>Amount: {lookupResult.amount === 0n ? "Any amount" : `${formatUnits(lookupResult.amount, USDC_DECIMALS)} USDC`}</p>
                <p>Status: <strong className={lookupResult.paid ? "text-emerald-700" : "text-amber-700"}>{lookupResult.paid ? "Paid" : "Unpaid"}</strong></p>
                {lookupResult.paid && (
                  <>
                    <p>Payer: <code className="break-all">{lookupResult.payer}</code></p>
                    <p>Paid at: {new Date(Number(lookupResult.paidAt) * 1000).toLocaleString()}</p>
                  </>
                )}
                {!lookupResult.paid && (
                  <Button type="button" variant="outline" onClick={() => {
                    setPayLinkId(lookupId.trim());
                    setPayAmount(lookupResult.amount > 0n ? formatUnits(lookupResult.amount, USDC_DECIMALS) : "");
                    setPayError(null);
                  }}>
                    Fill Payment Form
                  </Button>
                )}
              </div>
            )}
            <ErrorMessage message={lookupError} />
          </form>

          <form onSubmit={handlePay} className="space-y-3">
            <h3 className="font-semibold text-slate-900">3. Pay an on-chain link</h3>
            <Input
              type="text"
              value={payLinkId}
              onChange={(e) => setPayLinkId(e.target.value)}
              placeholder="On-chain Link ID (0x...)"
            />
            <Input
              type="number"
              min="0"
              step="0.000001"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="USDC amount (only required for any-amount links)"
            />
            <p className="text-xs text-slate-500">Fixed-amount links automatically use the amount recorded on-chain. Confirm transaction details in your wallet.</p>
            <Button type="submit" disabled={paying}>
              {paying ? "Waiting for confirmation..." : "Approve & Pay"}
            </Button>
            {payTxHash && (
              <a href={explorerTxUrl(payTxHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 underline">
                <ExternalLink size={14} /> View payment transaction on ArcScan
              </a>
            )}
            <ErrorMessage message={payError} />
          </form>
        </div>
      )}
    </Card>
  );
}
