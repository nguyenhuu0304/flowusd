
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast, Toaster } from "sonner";

import {
  BATCH_CONTRACT_ADDRESS,
  batchIsConfigured,
  readUsdcAllowance,
  approveUsdc,
  payBatchLink,
  requireArc,
  waitForBatchReceipt,
} from "@/lib/web3/batchPaymentLinks";

import {
  decodeGetLink,
  encodeGetLink,
  type OnChainPaymentLink,
} from "@/lib/web3/paymentLinksAbi";

import {
  ARC_TESTNET_PARAMS,
  ARC_TESTNET_CHAIN_ID_HEX,
  USDC_DECIMALS,
  explorerTxUrl,
  explorerAddressUrl,
} from "@/lib/web3/config";

import { formatUnits } from "@/lib/web3/erc20";
import type { Eip1193Provider } from "@/lib/web3/provider";

const RPC_URL = "https://rpc.testnet.arc.network";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ID_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

type MobileProvider = Eip1193Provider & {
  connect: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
};

async function publicLink(id: string): Promise<OnChainPaymentLink> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: BATCH_CONTRACT_ADDRESS,
          data: encodeGetLink(id),
        },
        "latest",
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Arc Testnet RPC HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: string;
    error?: {
      message?: string;
    };
  };

  if (payload.error) {
    throw new Error(payload.error.message || "Arc RPC error");
  }

  if (!payload.result || payload.result.length !== 322) {
    throw new Error("Invalid contract response");
  }

  return decodeGetLink(payload.result);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function ensureArc(
  provider: Eip1193Provider
): Promise<void> {
  try {
    await requireArc(provider);
    return;
  } catch {
    // Try selecting Arc Testnet in a compatible wallet.
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: ARC_TESTNET_CHAIN_ID_HEX,
        },
      ],
    });
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [ARC_TESTNET_PARAMS],
    });
  }

  await requireArc(provider);
}

export default function PaySplitPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] =
    useState<OnChainPaymentLink | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const [payer, setPayer] = useState("");
  const [paymentHash, setPaymentHash] = useState("");

  const [walletAvailable, setWalletAvailable] =
    useState<boolean | null>(null);

  const [copied, setCopied] = useState(false);
  const [connectingMobile, setConnectingMobile] = useState(false);

  const busy = useRef(false);

  const walletRef = useRef<Eip1193Provider | null>(null);

  const mobileProviderRef =
    useRef<Promise<MobileProvider> | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!batchIsConfigured()) {
        throw new Error(
          "Batch payment contract is not configured on this website."
        );
      }

      if (!ID_REGEX.test(id)) {
        throw new Error("Invalid payment link ID.");
      }

      const link = await publicLink(id);

      if (link.creator.toLowerCase() === ZERO_ADDRESS) {
        throw new Error("Payment request not found on-chain.");
      }

      setData(link);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setWalletAvailable(Boolean(window.ethereum));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    walletRef.current = null;
    setPayer("");
    setPaymentHash("");
  }, [id]);

  async function copyPaymentUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);

      setCopied(true);

      toast.success("Payment link copied.");
    } catch {
      toast.error(
        "Copy unavailable. Copy the URL from the address bar."
      );
    }
  }

  async function initMobile(): Promise<MobileProvider> {
    if (!WC_PROJECT_ID) {
      throw new Error(
        "WalletConnect Project ID is missing."
      );
    }

    if (!mobileProviderRef.current) {
      mobileProviderRef.current = (async () => {
        const { EthereumProvider } = await import(
          "@walletconnect/ethereum-provider"
        );

        const provider = await EthereumProvider.init({
          projectId: WC_PROJECT_ID,

          optionalChains: [5042002],

          rpcMap: {
            5042002: RPC_URL,
          },

          showQrModal: true,

          metadata: {
            name: "FlowUSD",
            description: "Arc Testnet USDC Payment",
            url: window.location.origin,
            icons: [
              window.location.origin + "/favicon.ico",
            ],
          },
        });

        return provider as unknown as MobileProvider;
      })().catch((e) => {
        mobileProviderRef.current = null;
        throw e;
      });
    }

    return mobileProviderRef.current;
  }

  async function connectMobile() {
    if (connectingMobile || paying) return;

    setConnectingMobile(true);

    try {
      const provider = await initMobile();

      // IMPORTANT:
      // A WalletConnect session must be established
      // before eth_accounts or other RPC requests.

      await provider.connect();

      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];

      if (!accounts?.[0] || !ADDRESS_REGEX.test(accounts[0])) {
        throw new Error(
          "No valid wallet account was selected."
        );
      }

      const chainId = String(
        await provider.request({
          method: "eth_chainId",
        })
      ).toLowerCase();

      if (
        chainId !== ARC_TESTNET_CHAIN_ID_HEX.toLowerCase()
      ) {
        throw new Error(
          "Please use a wallet supporting Arc Testnet (5042002)."
        );
      }

      await requireArc(provider);

      walletRef.current = provider;
      setPayer(accounts[0]);

      toast.success("Mobile wallet connected!");
    } catch (e) {
      walletRef.current = null;
      setPayer("");

      toast.error(messageOf(e), {
        duration: 9000,
      });
    } finally {
      setConnectingMobile(false);
    }
  }

  async function connectBrowser() {
    try {
      if (!window.ethereum) {
        throw new Error(
          "No compatible browser wallet was found."
        );
      }

      const provider = window.ethereum;

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts?.[0] || !ADDRESS_REGEX.test(accounts[0])) {
        throw new Error(
          "No wallet account selected."
        );
      }

      await ensureArc(provider);

      walletRef.current = provider;
      setPayer(accounts[0]);

      toast.success("Browser wallet connected!");
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  async function pay() {
    if (
      busy.current ||
      !data ||
      data.paid ||
      !payer ||
      !walletRef.current
    ) {
      return;
    }

    busy.current = true;
    setPaying(true);

    try {
      const provider = walletRef.current;

      await requireArc(provider);

      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];

      if (
        !accounts?.some(
          (a) =>
            a.toLowerCase() === payer.toLowerCase()
        )
      ) {
        throw new Error(
          "Connected wallet changed. Reconnect."
        );
      }

      const fresh = await publicLink(id);

      if (fresh.paid) {
        setData(fresh);
        throw new Error(
          "This payment link is already paid."
        );
      }

      if (
        fresh.creator.toLowerCase() !==
          data.creator.toLowerCase() ||
        fresh.amount !== data.amount
      ) {
        throw new Error(
          "Payment request changed. Refresh the page."
        );
      }

      if (fresh.amount <= 0n) {
        throw new Error(
          "Invalid payment amount."
        );
      }

      const allowance = await readUsdcAllowance(
        provider,
        payer
      );

      if (allowance < fresh.amount) {
        toast.message(
          "Step 1/2: Approve the exact USDC amount in your wallet."
        );

        const approveHash = await approveUsdc(
          provider,
          payer,
          fresh.amount
        );

        await waitForBatchReceipt(
          provider,
          approveHash
        );
      }

      toast.message(
        "Confirm payment in your wallet."
      );

      const hash = await payBatchLink(
        provider,
        payer,
        id,
        fresh.amount
      );

      setPaymentHash(hash);

      await waitForBatchReceipt(
        provider,
        hash
      );

      await reload();

      toast.success(
        "Payment confirmed on Arc Testnet!"
      );
    } catch (e) {
      toast.error(messageOf(e), {
        duration: 9000,
      });
    } finally {
      busy.current = false;
      setPaying(false);
    }
  }

  const amount = data
    ? formatUnits(data.amount, USDC_DECIMALS)
    : "—";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Toaster
        position="top-center"
        richColors
      />

      <div className="w-full max-w-lg space-y-5">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">
            FlowUSD
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Arc Testnet · Split Bill Payment
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {loading && (
            <p className="text-center">
              Reading payment request from Arc Testnet...
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </p>
          )}

          {data && (
            <>
              <div className="text-center">
                <p className="text-sm text-slate-500">
                  {data.paid
                    ? "Payment completed"
                    : "Payment requested"}
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {amount} USDC
                </p>

                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                    data.paid
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {data.paid ? "Paid" : "Unpaid"}
                </span>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800">
                <p>
                  Recipient:{" "}
                  <a
                    href={explorerAddressUrl(data.creator)}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-blue-600 underline"
                  >
                    {data.creator}
                  </a>
                </p>

                <p>
                  Contract:{" "}
                  <a
                    href={explorerAddressUrl(
                      BATCH_CONTRACT_ADDRESS
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-blue-600 underline"
                  >
                    {BATCH_CONTRACT_ADDRESS}
                  </a>
                </p>

                <p>
                  Link ID:{" "}
                  <span className="break-all font-mono">
                    {id}
                  </span>
                </p>

                {data.paid && (
                  <>
                    <p>
                      Payer:{" "}
                      <span className="break-all">
                        {data.payer}
                      </span>
                    </p>

                    <p>
                      Paid at:{" "}
                      {new Date(
                        Number(data.paidAt) * 1000
                      ).toLocaleString()}
                    </p>
                  </>
                )}
              </div>

              {!data.paid && !payer && (
                <div className="space-y-3">
                  {walletAvailable && (
                    <button
                      type="button"
                      disabled={connectingMobile}
                      onClick={() =>
                        void connectBrowser()
                      }
                      className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      Connect browser wallet
                    </button>
                  )}

                  {WC_PROJECT_ID ? (
                    <button
                      type="button"
                      disabled={connectingMobile}
                      onClick={() =>
                        void connectMobile()
                      }
                      className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {connectingMobile
                        ? "Connecting mobile wallet..."
                        : "Connect mobile wallet (WalletConnect)"}
                    </button>
                  ) : (
                    <p className="text-sm text-amber-600">
                      Configure WalletConnect Project ID
                      to enable mobile wallets.
                    </p>
                  )}

                  {walletAvailable === false && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700 dark:border-blue-800 dark:bg-blue-950 dark:text-slate-100">
                      <p className="font-semibold">
                        Paying from Telegram on a phone?
                      </p>

                      <p className="mt-2">
                        Use WalletConnect with a supported
                        mobile wallet. Do not enter your
                        recovery phrase on this website.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void copyPaymentUrl()
                        }
                        className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"
                      >
                        {copied
                          ? "Payment URL copied"
                          : "Copy payment URL"}
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    Arc Testnet only. Never bypass wallet
                    security warnings.
                  </p>
                </div>
              )}

              {!data.paid && payer && (
                <div className="space-y-3">
                  <p className="break-all text-xs text-slate-500">
                    Payer: {payer}
                  </p>

                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => void pay()}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {paying
                      ? "Waiting for wallet / confirmation..."
                      : `Pay ${amount} USDC`}
                  </button>

                  <p className="text-xs text-slate-500">
                    Your wallet may request an exact USDC
                    approval followed by payment. Never
                    approve unlimited funds.
                  </p>
                </div>
              )}
            </>
          )}

          {paymentHash && (
            <a
              href={explorerTxUrl(paymentHash)}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-center text-xs text-blue-600 underline"
            >
              View payment transaction ↗
            </a>
          )}

          <button
            type="button"
            disabled={loading || paying}
            onClick={() => void reload()}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold disabled:opacity-50 dark:border-slate-600"
          >
            Refresh payment status
          </button>
        </section>

        <p className="text-center text-xs text-slate-500">
          Arc Testnet only. Never share private keys or
          recovery phrases.
        </p>
      </div>
    </main>
  );
}
