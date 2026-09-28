"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Wallet2, ExternalLink, RefreshCw } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { shortenAddress, copyToClipboard } from "@/lib/utils";
import {
  ARC_FAUCET_URL,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/web3/config";

export default function Web3WalletCard() {
  const {
    isMetaMaskAvailable,
    discoveryDone,
    wallets,
    needsWalletSelection,
    address,
    isOnArcTestnet,
    balance,
    connecting,
    loadingBalance,
    sending,
    connect,
    connectWith,
    disconnect,
    send,
    refreshBalance,
  } = useWeb3Wallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  async function handleConnect() {
    try {
      await connect();
    } catch (error) {
      console.error("[wallet] handleConnect error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not connect the wallet.";

      toast.error(message);
    }
  }

  async function handleConnectWith(wallet: (typeof wallets)[number]) {
    try {
      await connectWith(wallet);
    } catch (error) {
      console.error("[wallet] handleConnectWith error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not connect the wallet.";

      toast.error(message);
    }
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLastTxHash(null);

    try {
      const hash = await send(recipient, amount);
      setLastTxHash(hash);
      setRecipient("");
      setAmount("");
      toast.success("Transaction submitted to Arc Testnet.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Transaction failed or was rejected.";

      toast.error(message);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet2 size={20} className="text-blue-600" />

            <h2 className="text-xl font-bold text-slate-900">
              On-chain Wallet
            </h2>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Arc Testnet
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Real wallet connection via MetaMask. Testnet only — no real
            funds are involved.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm"
          disabled
        >
          Arc Testnet
        </button>

        <button
          onClick={() =>
            toast.info("Arc Mainnet isn't live yet", {
              description:
                "Circle hasn't launched Arc Mainnet publicly yet — this option will turn on here once it does.",
            })
          }
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-slate-600"
        >
          Arc Mainnet
          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            Soon
          </span>
        </button>
      </div>

      {!discoveryDone && !isMetaMaskAvailable ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          Detecting installed wallets...
        </div>
      ) : !isMetaMaskAvailable ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-600">
            No wallet extension detected in this browser.
          </p>

          <a
            href="https://metamask.io/download"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"
          >
            Install MetaMask
            <ExternalLink size={14} />
          </a>
        </div>
      ) : needsWalletSelection ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="mb-4 text-center text-slate-600">
            Multiple wallets detected — choose which one to use.
          </p>

          <div className="space-y-3">
            {wallets.map((wallet) => (
              <button
                key={wallet.uuid}
                onClick={() => handleConnectWith(wallet)}
                disabled={connecting}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {wallet.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wallet.icon}
                    alt=""
                    className="h-6 w-6 rounded"
                  />
                ) : (
                  <Wallet2 size={20} className="text-blue-600" />
                )}

                <span>{wallet.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : !address ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="mb-4 text-slate-600">
            Connect a wallet to view your real Arc Testnet USDC balance and
            send an on-chain transfer.
          </p>

          <Button onClick={handleConnect} disabled={connecting}>
            <Wallet2 size={18} />
            <span>
              {connecting ? "Connecting..." : "Connect Wallet"}
            </span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-5">
            <div>
              <p className="text-sm text-slate-500">Connected Address</p>

              <button
                onClick={() => {
                  copyToClipboard(address);
                  toast.success("Address copied!");
                }}
                className="mt-1 font-mono font-semibold text-slate-900 hover:text-blue-600"
                title="Copy address"
              >
                {shortenAddress(address)}
              </button>
            </div>

            <a
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              View on ArcScan
              <ExternalLink size={14} />
            </a>
          </div>

          {!isOnArcTestnet ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Your wallet is on a different network. Switch to Arc Testnet
              from within your wallet, or reconnect below.
              <Button
                variant="outline"
                className="mt-3"
                onClick={handleConnect}
              >
                Switch to Arc Testnet
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-blue-50 p-5">
                <div>
                  <p className="text-sm text-blue-700">
                    On-chain USDC Balance
                  </p>

                  <h3 className="mt-1 text-2xl font-bold text-blue-900">
                    {loadingBalance
                      ? "Loading..."
                      : `${balance ?? "0"} USDC`}
                  </h3>
                </div>

                <button
                  onClick={() => refreshBalance()}
                  className="rounded-xl p-2 text-blue-700 transition hover:bg-blue-100"
                  title="Refresh balance"
                >
                  <RefreshCw size={18} />
                </button>
              </div>

              {balance === "0" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Your testnet balance is empty. Get free testnet USDC
                  (needed for gas too) from the{" "}
                  <a
                    href={ARC_FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Circle Faucet
                  </a>
                  .
                </div>
              )}

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Recipient Address
                  </label>

                  <Input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Amount (USDC)
                  </label>

                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1.0"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full justify-center"
                >
                  {sending
                    ? "Confirm in wallet..."
                    : "Send On-chain (Testnet)"}
                </Button>
              </form>

              {lastTxHash && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Submitted:{" "}
                  <a
                    href={explorerTxUrl(lastTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {shortenAddress(lastTxHash)}
                  </a>
                </div>
              )}
            </>
          )}

          <button
            onClick={disconnect}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Disconnect (local only)
          </button>
        </div>
      )}
    </Card>
  );
}
