"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import QRCode from "react-qr-code";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  QrCode,
  Share2,
  UserRound,
} from "lucide-react";

import { toast } from "sonner";

import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";

import {
  BATCH_CONTRACT_ADDRESS,
} from "@/lib/web3/batchPaymentLinks";

import {
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/web3/config";

import {
  formatUnits,
} from "@/lib/web3/erc20";

type Member = {
  id: string;
  name: string;
  raw: string;
  status: "pending" | "unpaid" | "paid";
  payer?: string;
  directoryId?: string | null;
};

type Bill = {
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

type BillStatus =
  | "pending"
  | "unpaid"
  | "partial"
  | "paid";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

function storageKey(
  owner: string
): string {
  return (
    "flowusd:batch-bills:v1:" +
    BATCH_CONTRACT_ADDRESS.toLowerCase() +
    ":" +
    owner.toLowerCase()
  );
}

function money(
  raw: string
): string {
  try {
    return formatUnits(
      BigInt(raw),
      6
    );
  } catch {
    return "0";
  }
}

function readBills(
  owner: string
): Bill[] {
  try {
    const raw =
      localStorage.getItem(
        storageKey(owner)
      );

    const parsed: unknown =
      JSON.parse(
        raw || "[]"
      );

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    return parsed.filter(
      (
        value
      ): value is Bill => {
        if (
          !value ||
          typeof value !== "object"
        ) {
          return false;
        }

        const bill =
          value as Partial<Bill>;

        return (
          typeof bill.id === "string" &&
          typeof bill.creator === "string" &&
          typeof bill.title === "string" &&
          typeof bill.totalRaw === "string" &&
          Array.isArray(
            bill.members
          )
        );
      }
    );
  } catch {
    return [];
  }
}

function shortAddress(
  value: string
): string {
  if (
    value.length <= 14
  ) {
    return value;
  }

  return (
    value.slice(0, 8) +
    "..." +
    value.slice(-6)
  );
}

function getBillStatus(
  bill: Bill
): BillStatus {
  if (
    bill.stage !==
    "confirmed"
  ) {
    return "pending";
  }

  const paid =
    bill.members.filter(
      member =>
        member.status ===
        "paid"
    ).length;

  if (
    paid ===
      bill.members.length &&
    bill.members.length > 0
  ) {
    return "paid";
  }

  if (
    paid > 0
  ) {
    return "partial";
  }

  return "unpaid";
}

function hasRealPayer(
  payer?: string
): boolean {
  return (
    typeof payer === "string" &&
    payer.toLowerCase() !==
      ZERO_ADDRESS
  );
}

function billStatusLabel(
  status: BillStatus
): string {
  const labels: Record<
    BillStatus,
    string
  > = {
    pending:
      "Pending verification",

    unpaid:
      "Unpaid",

    partial:
      "Partially paid",

    paid:
      "Paid",
  };

  return labels[
    status
  ];
}

function billStatusClass(
  status: BillStatus
): string {
  const classes: Record<
    BillStatus,
    string
  > = {
    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",

    unpaid:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",

    partial:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",

    paid:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };

  return classes[
    status
  ];
}

function memberStatusLabel(
  status: Member["status"]
): string {
  if (
    status === "paid"
  ) {
    return "Paid";
  }

  if (
    status === "pending"
  ) {
    return "Pending";
  }

  return "Unpaid";
}

function memberStatusClass(
  status: Member["status"]
): string {
  if (
    status === "paid"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (
    status === "pending"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }

  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

export default function BillDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const wallet =
    useWeb3Wallet();

  const owner =
    wallet.address;

  const billId =
    params.id;

  const [
    bill,
    setBill,
  ] =
    useState<Bill | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    notFound,
    setNotFound,
  ] =
    useState(false);

  const [
    visibleQr,
    setVisibleQr,
  ] =
    useState<
      Record<string, boolean>
    >({});

  useEffect(() => {
    if (!owner) {
      setLoading(false);
      return;
    }

    const bills =
      readBills(owner);

    const found =
      bills.find(
        item =>
          item.id
            .toLowerCase() ===
          billId
            .toLowerCase()
      ) || null;

    setBill(found);

    setNotFound(
      !found
    );

    setLoading(false);
  }, [
    owner,
    billId,
  ]);

  const stats =
    useMemo(() => {
      if (!bill) {
        return {
          paid: 0,
          total: 0,
          received: 0n,
        };
      }

      const paidMembers =
        bill.members.filter(
          member =>
            member.status ===
            "paid"
        );

      const received =
        paidMembers.reduce(
          (
            total,
            member
          ) =>
            total +
            BigInt(
              member.raw
            ),
          0n
        );

      return {
        paid:
          paidMembers.length,

        total:
          bill.members.length,

        received,
      };
    }, [
      bill,
    ]);

  async function copy(
    value: string,
    message: string
  ) {
    try {
      await navigator.clipboard
        .writeText(
          value
        );

      toast.success(
        message
      );
    } catch {
      toast.error(
        "Copy failed"
      );
    }
  }

  async function shareBill() {
    if (!bill) {
      return;
    }

    const origin =
      window.location.origin;

    const memberLines =
      bill.members.map(
        (
          member,
          index
        ) => {
          const paymentUrl =
            `${origin}/pay/split/${member.id}`;

          const status =
            memberStatusLabel(
              member.status
            );

          return (
            `${index + 1}. ${member.name}` +
            ` — ${money(member.raw)} USDC` +
            ` — ${status}\n` +
            paymentUrl
          );
        }
      );

    const text = [
      `FlowUSD — ${bill.title}`,
      "",
      `Total: ${money(bill.totalRaw)} USDC`,
      `Paid: ${stats.paid}/${stats.total}`,
      "",
      "Payment links:",
      ...memberLines,
    ].join("\n");

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            `FlowUSD — ${bill.title}`,
          text,
        });

        return;
      }

      await navigator.clipboard
        .writeText(
          text
        );

      toast.success(
        "Bill summary copied"
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        /abort|cancel/i.test(
          message
        )
      ) {
        return;
      }

      try {
        await navigator.clipboard
          .writeText(
            text
          );

        toast.success(
          "Bill summary copied"
        );
      } catch {
        toast.error(
          "Unable to share bill"
        );
      }
    }
  }

  async function sharePayment(
    member: Member,
    paymentUrl: string
  ) {
    const title =
      bill?.title ||
      "FlowUSD payment";

    const text =
      `${member.name} · ${money(member.raw)} USDC · ${title}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "FlowUSD Payment Request",

          text,

          url:
            paymentUrl,
        });

        return;
      }

      await navigator.clipboard
        .writeText(
          paymentUrl
        );

      toast.success(
        "Payment link copied"
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        /abort|cancel/i.test(
          message
        )
      ) {
        return;
      }

      try {
        await navigator.clipboard
          .writeText(
            paymentUrl
          );

        toast.success(
          "Payment link copied"
        );
      } catch {
        toast.error(
          "Unable to share payment link"
        );
      }
    }
  }

  function toggleQr(
    memberId: string
  ) {
    setVisibleQr(
      previous => ({
        ...previous,

        [memberId]:
          !previous[
            memberId
          ],
      })
    );
  }

  if (
    loading
  ) {
    return (
      <main className="mx-auto w-full max-w-5xl overflow-x-hidden p-3 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          Loading bill...
        </div>
      </main>
    );
  }

  if (
    !owner
  ) {
    return (
      <main className="mx-auto w-full max-w-5xl overflow-x-hidden p-3 sm:p-6 lg:p-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h1 className="text-xl font-bold">
            Connect your wallet
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Connect the original bill creator wallet to view this bill.
          </p>
        </div>
      </main>
    );
  }

  if (
    notFound ||
    !bill
  ) {
    return (
      <main className="mx-auto w-full max-w-5xl overflow-x-hidden p-3 sm:p-6 lg:p-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <h1 className="text-xl font-bold">
            Bill not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            This bill is not available for the currently connected wallet.
          </p>

          <p className="mt-3 break-all font-mono text-xs text-slate-400">
            {billId}
          </p>
        </div>
      </main>
    );
  }

  const status =
    getBillStatus(
      bill
    );

  const progress =
    stats.total > 0
      ? (
          stats.paid /
          stats.total
        ) * 100
      : 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-6 lg:p-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText
                size={16}
                className="shrink-0"
              />

              <span>
                Bill Detail
              </span>
            </div>

            <h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {bill.title}
            </h1>

            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {new Date(
                bill.createdAt
              ).toLocaleString()}
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() =>
                void shareBill()
              }
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 sm:flex-none"
            >
              <Share2
                size={14}
                className="shrink-0"
              />

              <span>
                Share Bill
              </span>
            </button>

            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold ${billStatusClass(
                status
              )}`}
            >
              {billStatusLabel(
                status
              )}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-xs text-slate-500">
              Total
            </p>

            <p className="mt-1 break-words text-lg font-bold sm:text-xl">
              {money(
                bill.totalRaw
              )} USDC
            </p>
          </div>

          <div className="min-w-0 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-xs text-slate-500">
              Received
            </p>

            <p className="mt-1 break-words text-lg font-bold text-emerald-600 sm:text-xl">
              {money(
                stats.received.toString()
              )} USDC
            </p>
          </div>

          <div className="min-w-0 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-xs text-slate-500">
              Members paid
            </p>

            <p className="mt-1 text-lg font-bold sm:text-xl">
              {stats.paid}
              {" / "}
              {stats.total}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Payment progress
            </span>

            <span className="shrink-0">
              {Math.round(
                progress
              )}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Creator
            </p>

            <a
              href={
                explorerAddressUrl(
                  bill.creator
                )
              }
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex min-w-0 items-start gap-2 break-all font-mono text-[11px] leading-5 text-blue-600 sm:text-xs"
            >
              <span className="min-w-0 break-all">
                {bill.creator}
              </span>

              <ExternalLink
                size={13}
                className="mt-0.5 shrink-0"
              />
            </a>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Creation transaction
            </p>

            {bill.txHash ? (
              <a
                href={
                  explorerTxUrl(
                    bill.txHash
                  )
                }
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex min-w-0 items-start gap-2 break-all font-mono text-[11px] leading-5 text-blue-600 sm:text-xs"
              >
                <span className="min-w-0 break-all">
                  {bill.txHash}
                </span>

                <ExternalLink
                  size={13}
                  className="mt-0.5 shrink-0"
                />
              </a>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                No transaction hash
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs text-slate-500">
            Bill ID
          </p>

          <div className="mt-1 flex min-w-0 items-start gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 sm:text-xs">
              {bill.id}
            </p>

            <button
              type="button"
              onClick={() =>
                void copy(
                  bill.id,
                  "Bill ID copied"
                )
              }
              className="shrink-0 rounded-lg border border-slate-300 p-2 dark:border-slate-600"
              aria-label="Copy Bill ID"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center gap-2">
          <UserRound
            size={19}
            className="shrink-0"
          />

          <h2 className="text-lg font-bold">
            Members
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {bill.members.map(
            (
              member,
              index
            ) => {
              const paymentUrl =
                typeof window !==
                  "undefined"
                  ? `${window.location.origin}/pay/split/${member.id}`
                  : "";

              const showQr =
                !!visibleQr[
                  member.id
                ];

              return (
                <article
                  key={
                    member.id
                  }
                  className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        Member {
                          index + 1
                        }
                      </p>

                      <h3 className="mt-1 break-words font-semibold">
                        {member.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
                      <p className="break-words text-sm font-bold sm:text-base">
                        {money(
                          member.raw
                        )} USDC
                      </p>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${memberStatusClass(
                          member.status
                        )}`}
                      >
                        {
                          member.status ===
                          "paid"
                            ? (
                              <CheckCircle2
                                size={13}
                                className="shrink-0"
                              />
                            )
                            : (
                              <Clock3
                                size={13}
                                className="shrink-0"
                              />
                            )
                        }

                        {memberStatusLabel(
                          member.status
                        )}
                      </span>
                    </div>
                  </div>

                  {hasRealPayer(
                    member.payer
                  ) && (
                    <div className="mt-3 min-w-0 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                      <p className="text-slate-500">
                        Payer
                      </p>

                      <a
                        href={
                          explorerAddressUrl(
                            member.payer!
                          )
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 font-mono text-blue-600"
                      >
                        <span className="min-w-0 truncate">
                          {shortAddress(
                            member.payer!
                          )}
                        </span>

                        <ExternalLink
                          size={12}
                          className="shrink-0"
                        />
                      </a>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <a
                      href={
                        paymentUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-center text-xs font-semibold text-white sm:px-3"
                    >
                      <span className="truncate">
                        Open payment
                      </span>

                      <ExternalLink
                        size={13}
                        className="shrink-0"
                      />
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        void copy(
                          paymentUrl,
                          "Payment link copied"
                        )
                      }
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold dark:border-slate-600 sm:px-3"
                    >
                      <Copy
                        size={13}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        Copy link
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void sharePayment(
                          member,
                          paymentUrl
                        )
                      }
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold dark:border-slate-600 sm:px-3"
                    >
                      <Share2
                        size={13}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        Share
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleQr(
                          member.id
                        )
                      }
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold dark:border-slate-600 sm:px-3"
                    >
                      <QrCode
                        size={13}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        {
                          showQr
                            ? "Hide QR"
                            : "Show QR"
                        }
                      </span>
                    </button>
                  </div>

                  {showQr && (
                    <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 sm:p-4">
                      <div className="flex min-w-0 flex-col items-center">
                        <div className="w-full max-w-[220px] rounded-xl bg-white p-3 sm:p-4">
                          <QRCode
                            value={
                              paymentUrl
                            }
                            size={
                              180
                            }
                            level="M"
                            style={{
                              height:
                                "auto",
                              maxWidth:
                                "100%",
                              width:
                                "100%",
                            }}
                          />
                        </div>

                        <p className="mt-3 max-w-full break-words text-center text-sm font-semibold text-slate-900">
                          {member.name}
                        </p>

                        <p className="mt-1 text-center text-sm text-slate-600">
                          {money(
                            member.raw
                          )} USDC
                        </p>

                        <p className="mt-2 w-full break-all text-center font-mono text-[9px] leading-4 text-slate-400 sm:max-w-md sm:text-[10px]">
                          {paymentUrl}
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="mt-3 break-all font-mono text-[9px] leading-4 text-slate-400 sm:text-[10px]">
                    {member.id}
                  </p>
                </article>
              );
            }
          )}
        </div>
      </section>
    </main>
  );
}