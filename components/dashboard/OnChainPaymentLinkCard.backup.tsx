"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Wallet2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import {
  createLinkOnChain,
  generateOnChainLinkId,
  getLinkOnChain,
  getUsdcAllowance,
  isPaymentLinksContractConfigured,
  payLinkOnChain,
  approveUsdcForPaymentLinks,
  type OnChainPaymentLink,
} from "@/lib/web3/paymentLinksContract";
import { PAYMENT_LINKS_CONTRACT_ADDRESS } from "@/lib/web3/config";
import { parseUnits, formatUnits } from "@/lib/web3/erc20";
import { USDC_DECIMALS } from "@/lib/web3/config";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/web3/config";
import { shortenAddress } from "@/lib/utils";

export default function OnChainPaymentLinkCard() {
  const wallet = useWeb3Wallet();

  const [createAmount, setCreateAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLinkId, setCreatedLinkId] = useState<string | null>(null);
  const [createTxHash, setCreateTxHash] = useState<string | null>(null);

  const [payLinkId, setPayLinkId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payTxHash, setPayTxHash] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<OnChainPaymentLink | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  if (!isPaymentLinksContractConfigured()) {
    return (
      <Card className="p-8">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={20} className="text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900">
            On-chain Registry (Arc Testnet)
          </h2>
        </div>

        <p className="text-sm text-slate-500">
          Not configured yet. Deploy <code>FlowUSDPaymentLinks.sol</code> and
          set <code>NEXT_PUBLIC_PAYMENT_LINKS_CONTRACT_ADDRESS</code> in{" "}
          <code>.env.local</code> to enable this section.
        </p>
      </Card>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!wallet.address || !wallet.provider) {
      toast.error("Connect your wallet first.");
      return;
    }

    setCreating(true);
    setCreateTxHash(null);

    try {
      const linkId = generateOnChainLinkId();
      const amountRaw =
        createAmount.trim() === ""
          ? BigInt(0)
          : parseUnits(createAmount, USDC_DECIMALS);

      const hash = await createLinkOnChain(
        wallet.provider,
        wallet.address,
        linkId,
        amountRaw
      );

      setCreatedLinkId(linkId);
      setCreateTxHash(hash);
      toast.success("Link created on-chain!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create link.";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();

    if (!wallet.address || !wallet.provider) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(payLinkId.trim())) {
      toast.error("Link id must be a 32-byte hex value (0x...).");
      return;
    }

    setPaying(true);
    setPayTxHash(null);

    try {
      const amountRaw = parseUnits(payAmount || "0", USDC_DECIMALS);

      const allowance = await getUsdcAllowance(wallet.provider, wallet.address);

      if (allowance < amountRaw) {
        toast("Approving USDC spend first — confirm in your wallet.");
        await approveUsdcForPaymentLinks(wallet.provider, wallet.address, amountRaw);
      }

      const hash = await payLinkOnChain(
        wallet.provider,
        wallet.address,
        payLinkId.trim(),
        amountRaw
      );

      setPayTxHash(hash);
      toast.success("Payment sent on-chain!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed.";
      toast.error(message);
    } finally {
      setPaying(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();

    if (!wallet.provider) {
      toast.error("Connect your wallet first.");
      return;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(lookupId.trim())) {
      toast.error("Link id must be a 32-byte hex value (0x...).");
      return;
    }

    setLookingUp(true);

    try {
      const result = await getLinkOnChain(wallet.provider, lookupId.trim());
      setLookupResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed.";
      toast.error(message);
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={20} className="text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">
          On-chain Registry (Arc Testnet)
        </h2>
      </div>

      <p className="mb-6 text-sm text-slate-500">
        Real transactions against our own deployed contract —{" "}
        <a
          href={explorerAddressUrl(PAYMENT_LINKS_CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          {shortenAddress(PAYMENT_LINKS_CONTRACT_ADDRESS)}
        </a>{" "}
        on Arc Testnet. No demo data here.
      </p>

      {wallet.needsWalletSelection ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="mb-4 text-center text-slate-600">
            Multiple wallets detected — choose which one to use.
          </p>

          <div className="space-y-3">
            {wallet.wallets.map((w) => (
              <button
                key={w.uuid}
                onClick={() =>
                  wallet.connectWith(w).catch((e) => toast.error(e.message))
                }
                disabled={wallet.connecting}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
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
          {/* Create */}
          <form onSubmit={handleCreate} className="space-y-3 border-b border-slate-100 pb-6">
            <h3 className="font-semibold text-slate-900">Create a link on-chain</h3>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={createAmount}
              onChange={(e) => setCreateAmount(e.target.value)}
              placeholder="Amount (leave empty for any amount)"
            />

            <Button type="submit" disabled={creating}>
              {creating ? "Submitting..." : "Create On-Chain"}
            </Button>

            {createdLinkId && createTxHash && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs">
                <p className="break-all">
                  <span className="font-medium">Link id:</span> {createdLinkId}
                </p>
                <a
                  href={explorerTxUrl(createTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  View transaction on ArcScan
                </a>
              </div>
            )}
          </form>

          {/* Pay */}
          <form onSubmit={handlePay} className="space-y-3 border-b border-slate-100 pb-6">
            <h3 className="font-semibold text-slate-900">Pay a link on-chain</h3>

            <Input
              type="text"
              value={payLinkId}
              onChange={(e) => setPayLinkId(e.target.value)}
              placeholder="Link id (0x...)"
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount (must match fixed-amount links)"
            />

            <Button type="submit" disabled={paying}>
              {paying ? "Submitting..." : "Approve & Pay"}
            </Button>

            {payTxHash && (
              <a
                href={explorerTxUrl(payTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 underline"
              >
                View transaction on ArcScan
              </a>
            )}
          </form>

          {/* Lookup */}
          <form onSubmit={handleLookup} className="space-y-3">
            <h3 className="font-semibold text-slate-900">Look up a link</h3>

            <Input
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Link id (0x...)"
            />

            <Button type="submit" disabled={lookingUp} variant="outline">
              {lookingUp ? "Checking..." : "Check"}
            </Button>

            {lookupResult && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs">
                <p>Creator: {shortenAddress(lookupResult.creator)}</p>
                <p>
                  Amount:{" "}
                  {lookupResult.amount === BigInt(0)
                    ? "Any amount"
                    : formatUnits(lookupResult.amount, USDC_DECIMALS)}
                </p>
                <p>Paid: {lookupResult.paid ? "Yes" : "No"}</p>
                {lookupResult.paid && (
                  <p>Payer: {shortenAddress(lookupResult.payer)}</p>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </Card>
  );
}
