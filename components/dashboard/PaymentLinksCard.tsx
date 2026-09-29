
"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  QrCode,
  RefreshCw,
  Search,
  Wallet2,
} from "lucide-react";
import { useAppearance } from "@/contexts/AppearanceContext";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import {
  createLinkOnChain,
  generateOnChainLinkId,
  getLinkOnChain,
  isPaymentLinksContractConfigured,
} from "@/lib/web3/paymentLinksContract";
import {
  PAYMENT_LINKS_CONTRACT_ADDRESS,
  USDC_DECIMALS,
  explorerTxUrl,
} from "@/lib/web3/config";
import { parseUnits, formatUnits } from "@/lib/web3/erc20";
import { shortenAddress } from "@/lib/utils";
import type { Eip1193Provider } from "@/lib/web3/provider";
type SavedLink = {
  id: string;
  creator: string;
  memo: string;
  createdAt: string;
  createHash: string;
};
type ChainState = {
  amount: string;
  paid: boolean;
  payer: string;
  paidAt: string;
  verifiedAt: number;
};
type ChainLog = {
  topics: string[];
  transactionHash: string;
  removed?: boolean;
};
const ZERO =
  "0x0000000000000000000000000000000000000000";
const LINK_CREATED_TOPIC =
  "0x3c65ae310530c5dfdf6917866728cf7bf65bd8d07cca861ce7cb6679d5212980";
const DEPLOYMENT_TX =
  "0xde568755de1391c11aefd0f73bd9ff2486f1ca02ce624d025c0b25424cb97d85";
const SCAN_CHUNK = 500;
const CHUNKS_PER_SYNC = 4;
function keyFor(address: string) {
  return (
    "flowusd:onchain-links:" +
    PAYMENT_LINKS_CONTRACT_ADDRESS.toLowerCase() +
    ":" +
    address.toLowerCase()
  );
}
function stateKey(address: string) {
  return keyFor(address) + ":verified-state";
}
function cursorKey(address: string) {
  return keyFor(address) + ":scan-cursor";
}
function readSaved(address: string): SavedLink[] {
  try {
    const raw = localStorage.getItem(keyFor(address));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is SavedLink => {
      if (!value || typeof value !== "object") {
        return false;
      }
      const item = value as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        /^0x[a-fA-F0-9]{64}$/.test(item.id) &&
        typeof item.creator === "string" &&
        typeof item.memo === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.createHash === "string"
      );
    });
  } catch {
    return [];
  }
}
function writeSaved(address: string, links: SavedLink[]) {
  localStorage.setItem(
    keyFor(address),
    JSON.stringify(links)
  );
}
function mergeSaved(
  address: string,
  incoming: SavedLink[]
): SavedLink[] {
  const all = new Map<string, SavedLink>();
  for (const item of readSaved(address)) {
    all.set(item.id.toLowerCase(), item);
  }
  for (const item of incoming) {
    const id = item.id.toLowerCase();
    const old = all.get(id);
    all.set(id, {
      ...item,
      memo: old?.memo || item.memo,
      createdAt: old?.createdAt || item.createdAt,
    });
  }
  const result = Array.from(all.values());
  writeSaved(address, result);
  return result;
}
function readStates(
  address: string
): Record<string, ChainState> {
  try {
    const raw = localStorage.getItem(stateKey(address));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const result: Record<string, ChainState> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (
        !/^0x[a-fA-F0-9]{64}$/.test(id) ||
        !value ||
        typeof value !== "object"
      ) {
        continue;
      }
      const item = value as Record<string, unknown>;
      if (
        typeof item.amount !== "string" ||
        typeof item.paid !== "boolean" ||
        typeof item.payer !== "string" ||
        typeof item.paidAt !== "string" ||
        typeof item.verifiedAt !== "number"
      ) {
        continue;
      }
      result[id.toLowerCase()] = {
        amount: item.amount,
        paid: item.paid,
        payer: item.payer,
        paidAt: item.paidAt,
        verifiedAt: item.verifiedAt,
      };
    }
    return result;
  } catch {
    return {};
  }
}
function saveState(
  address: string,
  id: string,
  state: ChainState
) {
  const all = readStates(address);
  all[id.toLowerCase()] = state;
  localStorage.setItem(
    stateKey(address),
    JSON.stringify(all)
  );
}
function readCursor(address: string): number | null {
  const raw = localStorage.getItem(cursorKey(address));
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
function writeCursor(address: string, value: number) {
  localStorage.setItem(
    cursorKey(address),
    String(value)
  );
}
function toHex(value: number) {
  return "0x" + value.toString(16);
}
function parseBlock(hex: string) {
  const value = Number.parseInt(hex, 16);
  if (!Number.isSafeInteger(value)) {
    throw new Error("Invalid blockchain block number.");
  }
  return value;
}
function topicFor(address: string) {
  return (
    "0x" +
    address.slice(2).toLowerCase().padStart(64, "0")
  );
}
function pause(milliseconds: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}
function parseAmount(value: string) {
  const input = value.trim();
  if (!input) return 0n;
  if (!/^\d+(\.\d{1,6})?$/.test(input)) {
    throw new Error(
      "Enter a valid USDC amount with up to 6 decimals."
    );
  }
  const amount = parseUnits(input, USDC_DECIMALS);
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount;
}
async function waitForConfirmation(
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
    await pause(2000);
  }
  throw new Error(
    "Transaction confirmation timed out: " + hash
  );
}
function LinkRow({
  link,
  state,
  verifiedThisSession,
}: {
  link: SavedLink;
  state?: ChainState;
  verifiedThisSession: boolean;
}) {
  const { language, t } = useAppearance();
  const vi = language === "vi";
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setUrl(
      `${window.location.origin}/pay/onchain/${link.id}`
    );
  }, [link.id]);
  const amountText = state
    ? BigInt(state.amount) === 0n
      ? vi
        ? "Số tiền tùy chọn"
        : "Any amount"
      : `${formatUnits(
          BigInt(state.amount),
          USDC_DECIMALS
        )} USDC`
    : vi
      ? "Chưa tải số tiền"
      : "Amount not loaded";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(
        vi ? "Đã sao chép liên kết." : "Link copied."
      );
    } catch {
      toast.error(
        vi
          ? "Không thể sao chép."
          : "Could not copy the link."
      );
    }
  }
  async function downloadQr() {
    if (!qrRef.current) return;
    try {
      const png = await toPng(qrRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });
      const anchor = document.createElement("a");
      anchor.href = png;
      anchor.download =
        `flowusd-${link.id.slice(2, 12)}.png`;
      anchor.click();
    } catch {
      toast.error(
        vi
          ? "Không thể tải mã QR."
          : "Could not download QR."
      );
    }
  }
  const buttonClass =
    "inline-flex items-center justify-center gap-2 " +
    "rounded-xl border border-slate-300 px-4 py-2 " +
    "text-sm font-medium hover:bg-slate-50 " +
    "dark:border-slate-600 dark:hover:bg-slate-800";
  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {link.memo ||
              (vi ? "Yêu cầu thanh toán" : "Payment request")}
          </p>
          <p className="mt-2 text-2xl font-bold">
            {amountText}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !state
              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              : state.paid
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {!state
            ? vi
              ? "Chưa xác minh"
              : "Not verified"
            : state.paid
              ? t("paid")
              : t("unpaid")}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {!state
          ? vi
            ? "Nhấn Làm mới trạng thái để đọc blockchain."
            : "Refresh status to read the blockchain."
          : verifiedThisSession
            ? vi
              ? "Đã xác minh trong phiên này"
              : "Verified this session"
            : vi
              ? "Trạng thái lưu tạm — cần xác minh lại"
              : "Cached status — verification needed"}
      </p>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          On-chain Link ID
        </p>
        <code className="block break-all text-xs">
          {link.id}
        </code>
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          {vi ? "Liên kết chia sẻ" : "Payment URL"}
        </p>
        <code className="block break-all text-xs">
          {url}
        </code>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => void copyLink()}
          disabled={!url}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t("copied") : t("copyLink")}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => setShowQr(!showQr)}
        >
          <QrCode size={15} />
          {showQr ? t("hideQr") : t("showQr")}
        </button>
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          <ExternalLink size={15} />
          {t("open")}
        </a>
      </div>
      {showQr && url && (
        <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
          <div ref={qrRef} className="bg-white p-4">
            <QRCode value={url} size={180} />
          </div>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void downloadQr()}
          >
            <Download size={15} />
            {t("downloadQr")}
          </button>
        </div>
      )}
      <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        <p>
          {vi ? "Người tạo" : "Creator"}:{" "}
          {shortenAddress(link.creator)}
        </p>
        {state?.paid && (
          <>
            <p>
              {vi ? "Người trả" : "Payer"}:{" "}
              {shortenAddress(state.payer)}
            </p>
            <p>
              {vi ? "Thanh toán lúc" : "Paid at"}:{" "}
              {new Date(
                Number(state.paidAt) * 1000
              ).toLocaleString(
                vi ? "vi-VN" : "en-US"
              )}
            </p>
          </>
        )}
        {/^0x[a-fA-F0-9]{64}$/.test(link.createHash) && (
          <a
            href={explorerTxUrl(link.createHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 underline dark:text-blue-400"
          >
            {vi
              ? "Xem giao dịch tạo liên kết"
              : "View creation transaction"}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
export default function PaymentLinksCard() {
  const wallet = useWeb3Wallet();
  const { language, t } = useAppearance();
  const vi = language === "vi";
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [states, setStates] = useState<
    Record<string, ChainState>
  >({});
  const [verifiedIds, setVerifiedIds] =
    useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [scanCursor, setScanCursor] =
    useState<number | null>(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const configured =
    isPaymentLinksContractConfigured();
  const address = wallet.address;
  const provider = wallet.provider;
  const onArc = wallet.isOnArcTestnet;
  // Load locally saved links without RPC calls.
  useEffect(() => {
    const generation = ++generationRef.current;
    if (!address) {
      setLinks([]);
      setStates({});
      setVerifiedIds([]);
      setScanCursor(null);
      setMessage("");
      return;
    }
    const saved = readSaved(address);
    const snapshots = readStates(address);
    if (generation === generationRef.current) {
      setLinks(saved);
      setStates(snapshots);
      setVerifiedIds([]);
      setScanCursor(readCursor(address));
      setMessage("");
    }
  }, [address]);
  const refreshStatuses = useCallback(async () => {
    if (
      !address ||
      !provider ||
      !onArc ||
      busyRef.current
    ) {
      return;
    }
    busyRef.current = true;
    setRefreshing(true);
    setMessage("");
    const generation = generationRef.current;
    let succeeded = 0;
    let failed = 0;
    try {
      const saved = readSaved(address);
      for (const link of saved) {
        if (generation !== generationRef.current) {
          return;
        }
        try {
          const chain = await getLinkOnChain(
            provider,
            link.id
          );
          if (
            chain.creator.toLowerCase() === ZERO ||
            chain.creator.toLowerCase() !==
              address.toLowerCase()
          ) {
            failed++;
            continue;
          }
          const snapshot: ChainState = {
            amount: chain.amount.toString(),
            paid: chain.paid,
            payer: chain.payer,
            paidAt: chain.paidAt.toString(),
            verifiedAt: Date.now(),
          };
          saveState(address, link.id, snapshot);
          if (generation === generationRef.current) {
            setStates((old) => ({
              ...old,
              [link.id.toLowerCase()]: snapshot,
            }));
            setVerifiedIds((old) =>
              old.includes(link.id.toLowerCase())
                ? old
                : [...old, link.id.toLowerCase()]
            );
          }
          succeeded++;
        } catch (error) {
          console.warn(
            "[PaymentLinks] Status check failed:",
            error instanceof Error
              ? error.message
              : String(error)
          );
          failed++;
        }
        await pause(350);
      }
      if (generation === generationRef.current) {
        setMessage(
          vi
            ? `Đã kiểm tra ${succeeded} liên kết. ${failed} liên kết chưa xác minh được.`
            : `Checked ${succeeded} links. ${failed} could not be verified.`
        );
      }
    } finally {
      busyRef.current = false;
      setRefreshing(false);
    }
  }, [address, provider, onArc, vi]);
  // Scan only a limited number of blocks per click.
  // Save the cursor so the next scan resumes where it stopped.
  const syncHistory = useCallback(async () => {
    if (
      !address ||
      !provider ||
      !onArc ||
      !configured ||
      busyRef.current
    ) {
      return;
    }
    busyRef.current = true;
    setSyncing(true);
    setMessage("");
    const generation = generationRef.current;
    try {
      const receipt = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [DEPLOYMENT_TX],
      })) as { blockNumber?: string } | null;
      if (!receipt?.blockNumber) {
        throw new Error(
          "Cannot read contract deployment block."
        );
      }
      const latestHex = (await provider.request({
        method: "eth_blockNumber",
        params: [],
      })) as string;
      const latest = parseBlock(latestHex);
      let current =
        readCursor(address) ??
        parseBlock(receipt.blockNumber);
      const found: SavedLink[] = [];
      for (
        let i = 0;
        i < CHUNKS_PER_SYNC && current <= latest;
        i++
      ) {
        if (generation !== generationRef.current) {
          return;
        }
        const end = Math.min(
          current + SCAN_CHUNK - 1,
          latest
        );
        const logs = (await provider.request({
          method: "eth_getLogs",
          params: [
            {
              address:
                PAYMENT_LINKS_CONTRACT_ADDRESS,
              fromBlock: toHex(current),
              toBlock: toHex(end),
              topics: [
                LINK_CREATED_TOPIC,
                null,
                topicFor(address),
              ],
            },
          ],
        })) as ChainLog[];
        for (const log of logs) {
          if (
            log.removed ||
            !Array.isArray(log.topics) ||
            log.topics.length !== 3
          ) {
            continue;
          }
          const id = log.topics[1];
          if (
            !/^0x[a-fA-F0-9]{64}$/.test(id) ||
            !/^0x[a-fA-F0-9]{64}$/.test(
              log.transactionHash
            )
          ) {
            continue;
          }
          found.push({
            id,
            creator: address,
            memo: "",
            createdAt: "",
            createHash: log.transactionHash,
          });
        }
        current = end + 1;
        // Persist successful progress after every chunk.
        writeCursor(address, current);
        if (i < CHUNKS_PER_SYNC - 1) {
          await pause(600);
        }
      }
      if (generation !== generationRef.current) {
        return;
      }
      const merged = mergeSaved(address, found);
      setLinks(merged);
      setScanCursor(current);
      setMessage(
        current > latest
          ? vi
            ? `Đã quét đến block mới nhất. Tìm thêm ${found.length} liên kết.`
            : `History scan completed. Found ${found.length} links in this batch.`
          : vi
            ? `Đã lưu tiến độ đến block ${current.toLocaleString("vi-VN")}. Tìm thêm ${found.length} liên kết.`
            : `Saved progress at block ${current.toLocaleString("en-US")}. Found ${found.length} links.`
      );
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : String(error);
      console.warn(
        "[PaymentLinks] History sync interrupted:",
        description
      );
      if (generation === generationRef.current) {
        setMessage(
          vi
            ? "RPC tạm thời không phản hồi. Dữ liệu đã lưu vẫn được giữ. Hãy thử lại sau."
            : "RPC is temporarily unavailable. Saved links are preserved. Try again later."
        );
      }
    } finally {
      busyRef.current = false;
      setSyncing(false);
    }
  }, [address, provider, onArc, configured, vi]);
  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (
      !configured ||
      !address ||
      !provider ||
      !onArc
    ) {
      toast.error(
        vi
          ? "Vui lòng kết nối ví trên Arc Testnet."
          : "Connect a wallet on Arc Testnet."
      );
      return;
    }
    if (busyRef.current || creating) {
      return;
    }
    busyRef.current = true;
    setCreating(true);
    try {
      const amountRaw = parseAmount(amount);
      const id = generateOnChainLinkId();
      const hash = await createLinkOnChain(
        provider,
        address,
        id,
        amountRaw
      );
      toast.message(
        vi
          ? "Đang chờ blockchain xác nhận..."
          : "Waiting for blockchain confirmation..."
      );
      await waitForConfirmation(provider, hash);
      const chain = await getLinkOnChain(
        provider,
        id
      );
      if (
        chain.creator.toLowerCase() !==
        address.toLowerCase()
      ) {
        throw new Error(
          "Link verification failed after confirmation."
        );
      }
      const entry: SavedLink = {
        id,
        creator: address,
        memo: memo.trim(),
        createdAt: new Date().toISOString(),
        createHash: hash,
      };
      const snapshot: ChainState = {
        amount: chain.amount.toString(),
        paid: chain.paid,
        payer: chain.payer,
        paidAt: chain.paidAt.toString(),
        verifiedAt: Date.now(),
      };
      const merged = mergeSaved(address, [entry]);
      saveState(address, id, snapshot);
      setLinks(merged);
      setStates((old) => ({
        ...old,
        [id.toLowerCase()]: snapshot,
      }));
      setVerifiedIds((old) => [
        ...old,
        id.toLowerCase(),
      ]);
      setAmount("");
      setMemo("");
      toast.success(
        vi
          ? "Đã tạo liên kết thanh toán!"
          : "Payment link created!"
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : vi
            ? "Không thể tạo liên kết."
            : "Could not create link."
      );
    } finally {
      busyRef.current = false;
      setCreating(false);
    }
  }
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
        <div className="mb-3 flex items-center gap-2">
          <Link2
            size={20}
            className="text-blue-600 dark:text-blue-400"
          />
          <h2 className="text-xl font-bold">
            {t("createPaymentLink")}
          </h2>
        </div>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          {vi
            ? "Tạo yêu cầu thanh toán USDC trên Arc Testnet."
            : "Create a USDC payment request on Arc Testnet."}
        </p>
        {!configured ? (
          <p className="text-red-600">
            {vi
              ? "Chưa cấu hình smart contract."
              : "Payment contract is not configured."}
          </p>
        ) : !address || !onArc ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Wallet2 size={17} className="mb-2" />
            {vi
              ? "Vui lòng kết nối ví Arc Testnet ở góc phải."
              : "Please connect your Arc Testnet wallet in the top-right corner."}
          </div>
        ) : (
          <form
            onSubmit={handleCreate}
            className="space-y-4"
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("amount")} (USDC)
              </label>
              <input
                type="number"
                min="0"
                step="0.000001"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder={
                  vi
                    ? "Để trống nếu người trả tự nhập số tiền"
                    : "Leave empty for any amount"
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("description")} ({t("optional")})
              </label>
              <textarea
                rows={2}
                value={memo}
                onChange={(event) =>
                  setMemo(event.target.value)
                }
                placeholder={
                  vi
                    ? "Khoản thanh toán này dành cho việc gì?"
                    : "What is this payment for?"
                }
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={creating || syncing || refreshing}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating
                ? vi
                  ? "Đang xác nhận..."
                  : "Confirming..."
                : t("createLink")}
            </button>
          </form>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            {t("yourPaymentLinks")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                !address ||
                !onArc ||
                syncing ||
                refreshing ||
                creating
              }
              onClick={() => void refreshStatuses()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-600"
            >
              <RefreshCw size={15} />
              {refreshing
                ? vi
                  ? "Đang kiểm tra..."
                  : "Checking..."
                : vi
                  ? "Làm mới trạng thái"
                  : "Refresh Status"}
            </button>
            <button
              type="button"
              disabled={
                !address ||
                !onArc ||
                syncing ||
                refreshing ||
                creating
              }
              onClick={() => void syncHistory()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-600"
            >
              <Search size={15} />
              {syncing
                ? vi
                  ? "Đang tìm..."
                  : "Scanning..."
                : vi
                  ? "Tìm liên kết cũ"
                  : "Sync Older Links"}
            </button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {vi
            ? "Liên kết đã lưu xuất hiện ngay. Nhấn Làm mới trạng thái để xác minh Paid/Unpaid trên blockchain."
            : "Saved links appear immediately. Use Refresh Status to verify Paid/Unpaid on-chain."}
        </p>
        {scanCursor !== null && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {vi
              ? "Tiến độ quét đã lưu"
              : "Saved scan cursor"}
            : {scanCursor.toLocaleString()}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          >
            {message}
          </p>
        )}
        {links.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {vi
              ? "Chưa có liên kết được lưu trên trình duyệt này. Nếu đã tạo link trước đây, hãy dùng Tìm liên kết cũ."
              : "No links saved in this browser. Use Sync Older Links to recover past links."}
          </p>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                state={states[link.id.toLowerCase()]}
                verifiedThisSession={verifiedIds.includes(
                  link.id.toLowerCase()
                )}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
