
import { NextRequest, NextResponse } from "next/server";
import type { Transaction } from "@/types/transaction";
import {
  USDC_CONTRACT_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/web3/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARC_RPC_URL =
  process.env.ARC_TESTNET_RPC_URL ||
  "https://rpc.testnet.arc.network";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const PAGE_BLOCKS = 2000;
const LOG_CHUNK_BLOCKS = 500;
const MAX_TRANSACTIONS = 100;
const MAX_RPC_ATTEMPTS = 4;
const RPC_PAUSE_MS = 500;
const CACHE_TTL_MS = 60_000;

type RpcLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
  removed?: boolean;
};

type RpcBlock = {
  timestamp: string;
};

type RpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
};

type TransactionPage = {
  transactions: Transaction[];
  scannedFrom: number;
  scannedTo: number;
  nextBefore: number | null;
};

type CacheEntry = {
  expiresAt: number;
  data: TransactionPage;
};

const pageCache = new Map<string, CacheEntry>();

const inFlight = new Map<
  string,
  Promise<TransactionPage>
>();

const timestampCache = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toHex(value: number): string {
  return "0x" + value.toString(16);
}

function fromHex(value: string): number {
  const result = Number.parseInt(value, 16);

  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("Invalid block number returned by Arc RPC.");
  }

  return result;
}

function validAddress(
  value: string | null
): value is string {
  return (
    typeof value === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(value)
  );
}

function topicForAddress(address: string): string {
  return (
    "0x" +
    address.slice(2).toLowerCase().padStart(64, "0")
  );
}

function addressFromTopic(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(raw: bigint): number {
  const divisor = 10n ** BigInt(USDC_DECIMALS);

  const whole = raw / divisor;

  const fraction = (raw % divisor)
    .toString()
    .padStart(USDC_DECIMALS, "0");

  return Number(`${whole}.${fraction}`);
}

class RpcRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcRateLimitError";
  }
}

async function rpc<T>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  let lastError: Error = new Error(
    `RPC request failed: ${method}`
  );

  for (
    let attempt = 0;
    attempt < MAX_RPC_ATTEMPTS;
    attempt++
  ) {
    let retryDelay = RPC_PAUSE_MS * 2 ** attempt;

    try {
      const response = await fetch(ARC_RPC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });

      if (response.status === 429) {
        const retryAfter = Number(
          response.headers.get("retry-after")
        );

        if (
          Number.isFinite(retryAfter) &&
          retryAfter > 0
        ) {
          retryDelay = Math.min(
            retryAfter * 1000,
            15000
          );
        }

        throw new RpcRateLimitError(
          `Arc RPC rate limited: ${method}`
        );
      }

      if (!response.ok) {
        throw new Error(
          `Arc RPC HTTP ${response.status}: ${method}`
        );
      }

      const payload =
        (await response.json()) as RpcResponse<T>;

      if (payload.error) {
        const message =
          payload.error.message ||
          `RPC error: ${method}`;

        if (
          payload.error.code === 429 ||
          payload.error.code === -32005 ||
          /rate.limit|too many requests/i.test(message)
        ) {
          throw new RpcRateLimitError(message);
        }

        throw new Error(message);
      }

      if (payload.result === undefined) {
        throw new Error(
          `Arc RPC returned no result: ${method}`
        );
      }

      return payload.result;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      if (attempt === MAX_RPC_ATTEMPTS - 1) {
        break;
      }

      await sleep(retryDelay);
    }
  }

  throw lastError;
}

async function getTransferLogs(
  fromBlock: number,
  toBlock: number,
  walletTopic: string,
  direction: "sent" | "received"
): Promise<RpcLog[]> {
  const topics =
    direction === "sent"
      ? [TRANSFER_TOPIC, walletTopic]
      : [TRANSFER_TOPIC, null, walletTopic];

  return rpc<RpcLog[]>("eth_getLogs", [
    {
      address: USDC_CONTRACT_ADDRESS,
      fromBlock: toHex(fromBlock),
      toBlock: toHex(toBlock),
      topics,
    },
  ]);
}

async function getBlockTimestamp(
  blockNumber: string
): Promise<number> {
  const cached = timestampCache.get(blockNumber);

  if (cached !== undefined) {
    return cached;
  }

  const block = await rpc<RpcBlock | null>(
    "eth_getBlockByNumber",
    [blockNumber, false]
  );

  if (!block?.timestamp) {
    throw new Error(
      `Could not read timestamp for block ${blockNumber}`
    );
  }

  const timestamp = fromHex(block.timestamp) * 1000;

  timestampCache.set(blockNumber, timestamp);

  return timestamp;
}

function uniqueAndSortLogs(logs: RpcLog[]): RpcLog[] {
  const unique = new Map<string, RpcLog>();

  for (const log of logs) {
    if (log.removed) continue;

    if (
      !Array.isArray(log.topics) ||
      log.topics.length < 3
    ) {
      continue;
    }

    if (
      !/^0x[a-fA-F0-9]{64}$/.test(
        log.transactionHash
      )
    ) {
      continue;
    }

    const key =
      log.transactionHash.toLowerCase() +
      ":" +
      log.logIndex.toLowerCase();

    unique.set(key, log);
  }

  return Array.from(unique.values()).sort(
    (a, b) => {
      const blockDifference =
        fromHex(b.blockNumber) -
        fromHex(a.blockNumber);

      if (blockDifference !== 0) {
        return blockDifference;
      }

      return (
        fromHex(b.logIndex) -
        fromHex(a.logIndex)
      );
    }
  );
}

async function loadTransactionPage(
  walletAddress: string,
  before?: number
): Promise<TransactionPage> {
  const wallet = walletAddress.toLowerCase();

  let scannedTo: number;

  if (before === undefined) {
    const latestHex = await rpc<string>(
      "eth_blockNumber"
    );

    scannedTo = fromHex(latestHex);
  } else {
    scannedTo = before;
  }

  const scannedFrom = Math.max(
    0,
    scannedTo - PAGE_BLOCKS + 1
  );

  const walletTopic = topicForAddress(wallet);
  const allLogs: RpcLog[] = [];

  for (
    let start = scannedFrom;
    start <= scannedTo;
    start += LOG_CHUNK_BLOCKS
  ) {
    const end = Math.min(
      scannedTo,
      start + LOG_CHUNK_BLOCKS - 1
    );

    const sent = await getTransferLogs(
      start,
      end,
      walletTopic,
      "sent"
    );

    allLogs.push(...sent);

    await sleep(RPC_PAUSE_MS);

    const received = await getTransferLogs(
      start,
      end,
      walletTopic,
      "received"
    );

    allLogs.push(...received);

    if (end < scannedTo) {
      await sleep(RPC_PAUSE_MS);
    }
  }

  const sorted = uniqueAndSortLogs(allLogs);

  // The UI currently displays up to 100
  // token transfer events per scanned page.
  const selectedLogs = sorted.slice(
    0,
    MAX_TRANSACTIONS
  );

  const blockNumbers = Array.from(
    new Set(
      selectedLogs.map((log) => log.blockNumber)
    )
  );

  const timestamps = new Map<string, number>();

  for (const blockNumber of blockNumbers) {
    const timestamp = await getBlockTimestamp(
      blockNumber
    );

    timestamps.set(blockNumber, timestamp);

    await sleep(150);
  }

  const transactions: Transaction[] = [];

  for (const log of selectedLogs) {
    const from = addressFromTopic(log.topics[1]);
    const to = addressFromTopic(log.topics[2]);

    if (from === wallet && to === wallet) {
      continue;
    }

    if (from !== wallet && to !== wallet) {
      continue;
    }

    let rawAmount: bigint;

    try {
      rawAmount = BigInt(log.data);
    } catch {
      continue;
    }

    const amount = formatTokenAmount(rawAmount);

    if (!Number.isFinite(amount)) {
      continue;
    }

    const type: Transaction["type"] =
      to === wallet ? "income" : "expense";

    const counterparty =
      type === "income" ? from : to;

    const timestamp = timestamps.get(
      log.blockNumber
    );

    if (timestamp === undefined) {
      throw new Error(
        "Transaction timestamp was not loaded."
      );
    }

    transactions.push({
      id: `${log.transactionHash}:${log.logIndex}`,
      hash: log.transactionHash,
      name: shortenAddress(counterparty),
      address: counterparty,
      amount:
        type === "income" ? amount : -amount,
      type,
      status: "completed",
      createdAt: new Date(
        timestamp
      ).toISOString(),
      source: "onchain",
      blockNumber: fromHex(log.blockNumber),
    });
  }

  const nextBefore =
    scannedFrom > 0 ? scannedFrom - 1 : null;

  return {
    transactions,
    scannedFrom,
    scannedTo,
    nextBefore,
  };
}

async function getCachedPage(
  address: string,
  before?: number
): Promise<TransactionPage> {
  const key =
    address.toLowerCase() +
    ":" +
    (before === undefined ? "latest" : before);

  const cached = pageCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const running = inFlight.get(key);

  if (running) {
    return running;
  }

  const pending = loadTransactionPage(
    address,
    before
  );

  inFlight.set(key, pending);

  try {
    const result = await pending;

    pageCache.set(key, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  } finally {
    inFlight.delete(key);
  }
}

function parseBefore(
  value: string | null
): number | undefined {
  if (value === null) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      "Invalid before block number."
    );
  }

  const block = Number(value);

  if (!Number.isSafeInteger(block)) {
    throw new Error(
      "Invalid before block number."
    );
  }

  return block;
}

export async function GET(request: NextRequest) {
  const address =
    request.nextUrl.searchParams.get("address");

  if (!validAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid wallet address.",
      },
      { status: 400 }
    );
  }

  const paged =
    request.nextUrl.searchParams.get("paged") ===
    "1";

  let before: number | undefined;

  try {
    before = parseBefore(
      request.nextUrl.searchParams.get("before")
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid before parameter.",
      },
      { status: 400 }
    );
  }

  try {
    const page = await getCachedPage(
      address,
      before
    );

    // Backward compatibility for components
    // expecting only Transaction[].
    if (!paged) {
      return NextResponse.json(
        page.transactions,
        {
          headers: {
            "Cache-Control":
              "private, max-age=15",
          },
        }
      );
    }

    return NextResponse.json(page, {
      headers: {
        "Cache-Control":
          "private, max-age=15",
      },
    });
  } catch (error) {
    console.error(
      "[Arc Transactions]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Arc transactions.";

    const rateLimited =
      error instanceof RpcRateLimitError ||
      /429|rate.limit|too many requests/i.test(
        message
      );

    return NextResponse.json(
      {
        error: message,
        retryable: rateLimited,
      },
      {
        status: rateLimited ? 429 : 502,
        headers: rateLimited
          ? {
              "Retry-After": "10",
            }
          : {},
      }
    );
  }
}
