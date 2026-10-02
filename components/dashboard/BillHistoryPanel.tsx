
"use client";
import { useMemo, useState } from "react";
import { Download, Search, RefreshCcw, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatUnits } from "@/lib/web3/erc20";
type Member = {
  id: string;
  name: string;
  raw: string;
  status: "pending" | "unpaid" | "paid";
  payer?: string;
  directoryId?: string | null;
};
export type HistoryBill = {
  id: string;
  creator: string;
  title: string;
  createdAt: string;
  totalRaw: string;
  members: Member[];
  txHash: string;
  stage: "prepared" | "submitted" | "confirmed" | "needs_review";
};
type Props = {
  bills: HistoryBill[];
  vi: boolean;
  busy: boolean;
  canVerify: boolean;
  onVerify: (id: string, full: boolean) => void;
  verifyingBillId: string | null;
  verificationMessages: Record<string, string>;
  verifiedAt: Record<string, string>;
};
type Filter = "all" | "paid" | "partial" | "unpaid" | "pending";
function money(raw: string): string {
  try {
    return formatUnits(BigInt(raw), 6);
  } catch {
    return "0";
  }
}
function sum(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
function billStatus(bill: HistoryBill): Filter {
  if (bill.stage !== "confirmed") return "pending";
  const paid = bill.members.filter(m => m.status === "paid").length;
  const pending = bill.members.some(m => m.status === "pending");
  if (paid === bill.members.length && bill.members.length > 0) {
    return "paid";
  }
  if (pending) return "pending";
  if (paid > 0) return "partial";
  return "unpaid";
}
function safeCsv(value: unknown): string {
  let text = String(value ?? "");
  // Prevent spreadsheet applications interpreting untrusted names
  // or titles as formulas.
  if (/^\s*[=+@\-]/.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}
function csvDownload(
  filename: string,
  rows: Array<Array<string | number>>
) {
  const csv = "\uFEFF" + rows
    .map(row => row.map(safeCsv).join(","))
    .join("\r\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBills(bills: HistoryBill[]) {
  const rows: Array<Array<string | number>> = [[
    "Bill ID",
    "Bill Title",
    "Created At",
    "Bill Stage",
    "Member Name",
    "Member Status",
    "Amount USDC",
    "Payer Wallet",
    "Recipient Wallet",
    "Payment Link ID",
    "Payment URL",
    "Batch Creation Tx",
  ]];
  for (const bill of bills) {
    for (const member of bill.members) {
      rows.push([
        bill.id,
        bill.title,
        bill.createdAt,
        bill.stage,
        member.name,
        member.status,
        money(member.raw),
        member.payer || "",
        bill.creator,
        member.id,
        `${window.location.origin}/pay/split/${member.id}`,
        bill.txHash,
      ]);
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  csvDownload(`FlowUSD-Bill-History-${date}.csv`, rows);
}
export default function BillHistoryPanel({
  bills,
  vi,
  busy,
  canVerify,
  onVerify,
  verifyingBillId,
  verificationMessages,
  verifiedAt,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return bills
      .filter(b => {
        if (filter !== "all" && billStatus(b) !== filter) {
          return false;
        }
        const date = b.createdAt.slice(0, 10);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        if (!q) return true;
        return [
          b.title,
          b.id,
          b.creator,
          ...b.members.flatMap(m => [
            m.name,
            m.id,
            m.payer || "",
          ]),
        ].some(value => value.toLocaleLowerCase().includes(q));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [bills, query, filter, startDate, endDate]);
  const stats = useMemo(() => {
    const confirmed = filtered.filter(
      b => b.stage === "confirmed"
    );
    const allMembers = confirmed.flatMap(b => b.members);
    const paid = allMembers.filter(m => m.status === "paid");
    const unpaid = allMembers.filter(m => m.status === "unpaid");
    const pending = allMembers.filter(m => m.status === "pending");
    return {
      billCount: filtered.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      pendingCount: pending.length,
      received: sum(paid.map(m => BigInt(m.raw))),
      outstanding: sum(unpaid.map(m => BigInt(m.raw))),
    };
  }, [filtered]);
  const statusText: Record<Filter, string> = vi
    ? {
        all: "Tất cả",
        paid: "Đã thu đủ",
        partial: "Thu một phần",
        unpaid: "Chưa thu",
        pending: "Chờ xác minh",
      }
    : {
        all: "All",
        paid: "Fully paid",
        partial: "Partially paid",
        unpaid: "Unpaid",
        pending: "Pending verification",
      };
  const statCards = [
    {
      label: vi ? "Hóa đơn" : "Bills",
      value: String(stats.billCount),
    },
    {
      label: vi ? "Đã thu (USDC)" : "Received (USDC)",
      value: money(stats.received.toString()),
    },
    {
      label: vi ? "Chưa thu (USDC)" : "Outstanding (USDC)",
      value: money(stats.outstanding.toString()),
    },
    {
      label: vi ? "Thành viên đã trả" : "Members paid",
      value: String(stats.paidCount),
    },
  ];
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <FileText size={21} />
            {vi ? "Quản lý hóa đơn" : "Bill History & Tracking"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {vi
              ? "Dữ liệu lưu trên trình duyệt. Trạng thái phản ánh lần đối soát gần nhất."
              : "Browser-saved bills. Statuses reflect the latest verification."}
          </p>
        </div>
        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() => {
            exportBills(filtered);
            toast.success(
              vi ? "Đã xuất báo cáo CSV" : "CSV report exported"
            );
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(card => (
          <div
            key={card.label}
            className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
          >
            <p className="text-xs text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            {vi ? "Tìm kiếm" : "Search"}
          </span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 dark:border-slate-600">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={
                vi
                  ? "Tên hóa đơn, thành viên, Bill ID..."
                  : "Bill title, member, Bill ID..."
              }
              className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            {vi ? "Trạng thái" : "Status"}
          </span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as Filter)}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {Object.entries(statusText).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            {vi ? "Từ ngày" : "From"}
          </span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            {vi ? "Đến ngày" : "To"}
          </span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        {vi
          ? `${filtered.length} hóa đơn · ${stats.unpaidCount} người chưa trả · ${stats.pendingCount} đang chờ xác minh`
          : `${filtered.length} bills · ${stats.unpaidCount} unpaid members · ${stats.pendingCount} pending verification`}
      </p>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          {vi
            ? "Không tìm thấy hóa đơn phù hợp."
            : "No matching bills found."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bill => {
            const paidMembers = bill.members.filter(
              m => m.status === "paid"
            );
            const received = sum(
              paidMembers.map(m => BigInt(m.raw))
            );
            const status = billStatus(bill);
            return (
              <div
                key={bill.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">
                      {bill.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(bill.createdAt).toLocaleString(
                        vi ? "vi-VN" : "en-US"
                      )}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                      {bill.id}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {statusText[status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <strong className="text-emerald-600">
                      {money(received.toString())}
                    </strong>
                    {" / "}
                    {money(bill.totalRaw)} USDC
                  </p>
                  <p className="text-xs text-slate-500">
                    {paidMembers.length}/{bill.members.length}
                    {" "}
                    {vi ? "người đã trả" : "members paid"}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${
                        bill.members.length
                          ? (paidMembers.length / bill.members.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canVerify || (busy && verifyingBillId === null) || verifyingBillId === bill.id}
                    onClick={() => onVerify(bill.id, true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-600"
                  >
                    <RefreshCcw size={14} />
                    {verifyingBillId === bill.id ? (vi ? "Đang đối soát..." : "Verifying...") : (vi ? "Đối soát on-chain" : "Verify on-chain")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportBills([bill]);
                      toast.success("CSV exported");
                    }}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"
                  >
                    <Download size={14} />
                    CSV
                  </button>
                </div>
                {verificationMessages[bill.id] && (
                  <p role="status" className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    {verificationMessages[bill.id]}
                    {verifiedAt[bill.id] && (
                      <span className="ml-2 text-slate-500">
                        {vi ? "Xác minh lần cuối:" : "Last verified:"}{" "}
                        {new Date(verifiedAt[bill.id]).toLocaleString(vi ? "vi-VN" : "en-US")}
                      </span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
