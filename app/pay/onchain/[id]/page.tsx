
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet2,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";

import {
  approveUsdcForPaymentLinks,
  getLinkOnChain,
  getUsdcAllowance,
  payLinkOnChain,
  type OnChainPaymentLink,
} from "@/lib/web3/paymentLinksContract";

import {
  ARC_TESTNET_CHAIN_ID_HEX,
  PAYMENT_LINKS_CONTRACT_ADDRESS,
  USDC_DECIMALS,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/web3/config";

import { formatUnits, parseUnits } from "@/lib/web3/erc20";
import { shortenAddress } from "@/lib/utils";
import type { Eip1193Provider } from "@/lib/web3/provider";

const ZERO =
  "0x0000000000000000000000000000000000000000";

const LINK_PATTERN = /^0x[a-fA-F0-9]{64}$/;

type PageState =
  | "loading"
  | "ready"
  | "not-found"
  | "error";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForReceipt(
  provider: Eip1193Provider,
  hash: string
) {
  for (let attempt = 0; attempt < 45; attempt++) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;

    if (receipt) {
      if (
        receipt.status === "0x1" ||
        receipt.status === "0x01"
      ) {
        return;
      }

      throw new Error(
        "Transaction failed on-chain: " + hash
      );
    }

    await sleep(2000);
  }

  throw new Error(
    "Transaction not confirmed yet. Check ArcScan: " + hash
  );
}

async function ensureCorrectNetwork(
  provider: Eip1193Provider
) {
  const chain = await provider.request({
    method: "eth_chainId",
  });

  if (
    String(chain).toLowerCase() !==
    ARC_TESTNET_CHAIN_ID_HEX.toLowerCase()
  ) {
    throw new Error(
      "Please switch your wallet to Arc Testnet (5042002)."
    );
  }
}

function parsePaymentAmount(value: string): bigint {
  const input = value.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(input)) {
    throw new Error(
      "Enter a valid USDC amount, up to 6 decimals."
    );
  }

  const amount = parseUnits(input, USDC_DECIMALS);

  if (amount <= 0n) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  return amount;
}

export default function OnChainPayPage() {
  const params = useParams<{ id: string }>();
  const linkId = params.id;

  const wallet = useWeb3Wallet();

  const [pageState, setPageState] =
    useState<PageState>("loading");

  const [link, setLink] =
    useState<OnChainPaymentLink | null>(null);

  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLink = useCallback(async () => {
    setPageState("loading");
    setError(null);

    if (!LINK_PATTERN.test(linkId)) {
      setLink(null);
      setPageState("not-found");
      return;
    }

    try {
      const response = await fetch(
        "https://rpc.testnet.arc.network",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [
              {
                to: PAYMENT_LINKS_CONTRACT_ADDRESS,
                data: "0xf7291121" + linkId.slice(2),
              },
              "latest",
            ],
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Arc RPC HTTP ${response.status}`
        );
      }

      const payload = await response.json();

      if (payload.error) {
        throw new Error(
          payload.error.message ||
          "Could not read payment link."
        );
      }

      if (
        typeof payload.result !== "string" ||
        !/^0x(?:[a-fA-F0-9]{64}){5}$/.test(
          payload.result
        )
      ) {
        throw new Error(
          "Invalid contract response."
        );
      }

      const { decodeGetLink } = await import(
        "@/lib/web3/paymentLinksAbi"
      );

      const result = decodeGetLink(payload.result);

      if (result.creator.toLowerCase() === ZERO) {
        setLink(null);
        setPageState("not-found");
        return;
      }

      setLink(result);
      setPageState("ready");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load payment link.";

      setError(message);
      setPageState("error");
    }
  }, [linkId]);

  useEffect(() => {
    void loadLink();
  }, [loadLink]);

  async function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!wallet.address || !wallet.provider || !link) {
      toast.error("Connect a wallet first.");
      return;
    }

    setPaying(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = wallet.provider;

      await ensureCorrectNetwork(provider);

      // Re-read contract state before payment.
      const current = await getLinkOnChain(
        provider,
        linkId
      );

      if (current.creator.toLowerCase() === ZERO) {
        throw new Error("Payment link not found.");
      }

      if (current.paid) {
        await loadLink();
        throw new Error(
          "This payment request has already been paid."
        );
      }

      const amountRaw =
        current.amount > 0n
          ? current.amount
          : parsePaymentAmount(amount);

      if (amountRaw <= 0n) {
        throw new Error(
          "Payment amount must be greater than zero."
        );
      }

      const allowance = await getUsdcAllowance(
        provider,
        wallet.address
      );

      if (allowance < amountRaw) {
        toast.message(
          "Please confirm USDC approval in your wallet."
        );

        const approveHash =
          await approveUsdcForPaymentLinks(
            provider,
            wallet.address,
            amountRaw
          );

        toast.message(
          "Waiting for approval confirmation..."
        );

        await waitForReceipt(provider, approveHash);

        const updated = await getUsdcAllowance(
          provider,
          wallet.address
        );

        if (updated < amountRaw) {
          throw new Error(
            "USDC approval is insufficient."
          );
        }
      }

      await ensureCorrectNetwork(provider);

      // Check for another payment before submitting.
      const latest = await getLinkOnChain(
        provider,
        linkId
      );

      if (latest.paid) {
        await loadLink();
        throw new Error(
          "Payment link is already paid."
        );
      }

      toast.message(
        "Confirm the payment in your wallet."
      );

      const paymentHash = await payLinkOnChain(
        provider,
        wallet.address,
        linkId,
        amountRaw
      );

      setTxHash(paymentHash);

      toast.message(
        "Waiting for blockchain confirmation..."
      );

      await waitForReceipt(provider, paymentHash);

      const settled = await getLinkOnChain(
        provider,
        linkId
      );

      if (!settled.paid) {
        throw new Error(
          "Transaction confirmed but link is not marked paid."
        );
      }

      setLink(settled);
      setPageState("ready");

      toast.success(
        "Payment confirmed on Arc Testnet!"
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Payment failed.";

      setError(message);
      toast.error(message);
    } finally {
      setPaying(false);
    }
  }

  const amountLabel = link
    ? link.amount === 0n
      ? "Choose amount"
      : `${formatUnits(link.amount, USDC_DECIMALS)} USDC`
    : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">
            FlowUSD
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Secure on-chain payments on Arc Testnet
          </p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700">
            <ShieldCheck size={15} />
            Arc Testnet · USDC
          </div>
        </div>

        <Card className="p-8">
          {pageState === "loading" && (
            <p className="text-center text-slate-500">
              Reading payment request from blockchain...
            </p>
          )}

          {pageState === "not-found" && (
            <div className="text-center">
              <h2 className="text-xl font-bold">
                Payment link not found
              </h2>

              <p className="mt-3 text-sm text-slate-500">
                This ID does not exist in the configured
                Arc Testnet payment contract.
              </p>
            </div>
          )}

          {pageState === "error" && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold">
                Unable to load payment
              </h2>

              <p className="break-words text-sm text-red-600">
                {error}
              </p>

              <Button
                variant="outline"
                onClick={() => void loadLink()}
              >
                <RefreshCw size={16} />
                Retry
              </Button>
            </div>
          )}

          {pageState === "ready" && link && (
            <div className="space-y-6">
              <div className="text-center">
                {link.paid ? (
                  <CheckCircle2
                    size={48}
                    className="mx-auto text-emerald-600"
                  />
                ) : (
                  <Wallet2
                    size={48}
                    className="mx-auto text-blue-600"
                  />
                )}

                <p className="mt-4 text-sm text-slate-500">
                  {link.paid
                    ? "Payment completed"
                    : "Payment request"}
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {amountLabel}
                </h2>

                <span
                  className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-medium ${
                    link.paid
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {link.paid ? "Paid" : "Unpaid"}
                </span>
              </div>

              <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">
                    Recipient
                  </p>

                  <p className="mt-1 break-all font-mono text-xs text-slate-900">
                    {link.creator}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Contract
                  </p>

                  <a
                    href={explorerAddressUrl(
                      PAYMENT_LINKS_CONTRACT_ADDRESS
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-blue-600 underline"
                  >
                    {shortenAddress(
                      PAYMENT_LINKS_CONTRACT_ADDRESS
                    )}
                    <ExternalLink size={12} />
                  </a>
                </div>

                {link.paid && (
                  <>
                    <div>
                      <p className="text-xs text-slate-500">
                        Payer
                      </p>

                      <p className="mt-1 break-all font-mono text-xs">
                        {link.payer}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Paid at
                      </p>

                      <p className="mt-1">
                        {new Date(
                          Number(link.paidAt) * 1000
                        ).toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!link.paid && (
                <>
                  {!wallet.address ? (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-slate-500">
                        Connect your wallet to pay this request.
                      </p>

                      {wallet.needsWalletSelection ? (
                        wallet.wallets.map((option) => (
                          <Button
                            key={option.uuid}
                            variant="outline"
                            disabled={wallet.connecting}
                            className="w-full justify-center"
                            onClick={() =>
                              wallet
                                .connectWith(option)
                                .catch((err) =>
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Connection failed."
                                  )
                                )
                            }
                          >
                            <Wallet2 size={16} />
                            {option.name}
                          </Button>
                        ))
                      ) : (
                        <Button
                          className="w-full justify-center"
                          disabled={wallet.connecting}
                          onClick={() =>
                            wallet.connect().catch((err) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Connection failed."
                              )
                            )
                          }
                        >
                          <Wallet2 size={16} />
                          Connect Wallet
                        </Button>
                      )}
                    </div>
                  ) : !wallet.isOnArcTestnet ? (
                    <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                      Please switch your wallet to Arc Testnet
                      (Chain ID 5042002).
                    </p>
                  ) : (
                    <form
                      onSubmit={handlePay}
                      className="space-y-4"
                    >
                      <div className="rounded-xl border p-3 text-xs text-slate-600">
                        Connected wallet:{" "}
                        {shortenAddress(wallet.address)}
                      </div>

                      {link.amount === 0n && (
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Payment amount (USDC)
                          </label>

                          <Input
                            type="number"
                            min="0"
                            step="0.000001"
                            required
                            value={amount}
                            onChange={(e) =>
                              setAmount(e.target.value)
                            }
                            placeholder="Enter USDC amount"
                          />
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={paying}
                        className="w-full justify-center"
                      >
                        {paying
                          ? "Processing on-chain..."
                          : "Approve & Pay"}
                      </Button>

                      <p className="text-center text-xs text-slate-500">
                        This is an Arc Testnet payment.
                        Approval and payment may require
                        separate wallet confirmations.
                      </p>
                    </form>
                  )}
                </>
              )}

              {txHash && (
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-blue-600 underline"
                >
                  View payment on ArcScan
                  <ExternalLink size={15} />
                </a>
              )}

              {error && (
                <p
                  role="alert"
                  className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <Button
                variant="outline"
                className="w-full justify-center"
                disabled={paying}
                onClick={() => void loadLink()}
              >
                <RefreshCw size={15} />
                Refresh payment status
              </Button>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-slate-500">
          FlowUSD · Arc Testnet · Never share your
          recovery phrase or private keys.
        </p>
      </div>
    </main>
  );
}
