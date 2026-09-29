import { NextRequest, NextResponse } from "next/server";

import type { Transaction } from "@/types/transaction";
import {
  USDC_CONTRACT_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/web3/config";

const ARC_RPC_URL =
  process.env.ARC_TESTNET_RPC_URL ||
  "https://rpc.testnet.arc.network";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DEFAULT_LOOKBACK = 2_000;
const LOG_CHUNK_SIZE = 1_000;
const MAX_RESULTS = 100;

const RPC_RETRY_COUNT = 3;
const RPC_RETRY_DELAY_MS = 1_000;

type RpcLog = {
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
};

type RpcBlock = {
  timestamp: string;
};

type RpcResponse<T> = {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
};

let rpcId = 1;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rpc<T>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  let lastError: Error | null = null;

  for (
    let attempt = 1;
    attempt <= RPC_RETRY_COUNT;
    attempt++
  ) {
    try {
      const response = await fetch(ARC_RPC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: rpcId++,
          method,
          params,
        }),
        cache: "no-store",
      });

      if (response.status === 429) {
        const retryAfterHeader =
          response.headers.get("retry-after");

        const retryAfterMs =
          retryAfterHeader &&
          Number.isFinite(Number(retryAfterHeader))
            ? Number(retryAfterHeader) * 1_000
            : RPC_RETRY_DELAY_MS * attempt;

        lastError = new Error(
          `Arc RPC rate limited request: ${method}`
        );

        if (attempt < RPC_RETRY_COUNT) {
          await sleep(retryAfterMs);
          continue;
        }

        throw lastError;
      }

      if (!response.ok) {
        throw new Error(
          `Arc RPC HTTP ${response.status} for ${method}`
        );
      }

      const payload =
        (await response.json()) as RpcResponse<T>;

      if (payload.error) {
        throw new Error(
          payload.error.message ||
            `Arc RPC request failed: ${method}`
        );
      }

      if (payload.result === undefined) {
        throw new Error(
          `Arc RPC returned no result for ${method}`
        );
      }

      return payload.result;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error));

      if (attempt < RPC_RETRY_COUNT) {
        await sleep(RPC_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw (
    lastError ||
    new Error("Arc RPC request failed.")
  );
}

function toHex(value: number) {
  return `0x${Math.max(0, value).toString(16)}`;
}

function fromHex(value: string) {
  return Number.parseInt(value, 16);
}

function addressTopic(address: string) {
  return `0x${address
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0")}`;
}

function topicAddress(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUnits(
  raw: bigint,
  decimals: number
) {
  const divisor = 10n ** BigInt(decimals);

  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const frac = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${whole}.${frac}`;
}

async function getLogs(
  fromBlock: number,
  toBlock: number,
  topics: (string | null)[]
): Promise<RpcLog[]> {
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
  const block = await rpc<RpcBlock | null>(
    "eth_getBlockByNumber",
    [blockNumber, false]
  );

  if (!block?.timestamp) {
    return Date.now();
  }

  return fromHex(block.timestamp) * 1_000;
}

function validAddress(
  value: string | null
): value is string {
  return (
    !!value &&
    /^0x[a-fA-F0-9]{40}$/.test(value)
  );
}

export async function GET(
  request: NextRequest
) {
  const address =
    request.nextUrl.searchParams.get(
      "address"
    );

  if (!validAddress(address)) {
    return NextResponse.json(
      {
        error:
          "Invalid wallet address.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const latestHex =
      await rpc<string>(
        "eth_blockNumber"
      );

    const latest =
      fromHex(latestHex);

    const configuredLookback =
      Number(
        process.env
          .ARC_HISTORY_LOOKBACK_BLOCKS
      );

    const lookback =
      Number.isFinite(
        configuredLookback
      ) &&
      configuredLookback > 0
        ? configuredLookback
        : DEFAULT_LOOKBACK;

    const firstBlock =
      Math.max(
        0,
        latest - lookback
      );

    const wallet =
      address.toLowerCase();

    const walletTopic =
      addressTopic(wallet);

    const allLogs: RpcLog[] = [];

    for (
      let start = firstBlock;
      start <= latest;
      start += LOG_CHUNK_SIZE
    ) {
      const end =
        Math.min(
          latest,
          start +
            LOG_CHUNK_SIZE -
            1
        );

      const sentLogs =
        await getLogs(
          start,
          end,
          [
            TRANSFER_TOPIC,
            walletTopic,
          ]
        );

      await sleep(250);

      const receivedLogs =
        await getLogs(
          start,
          end,
          [
            TRANSFER_TOPIC,
            null,
            walletTopic,
          ]
        );

      allLogs.push(
        ...sentLogs,
        ...receivedLogs
      );

      await sleep(250);
    }

    const uniqueLogs =
      new Map<string, RpcLog>();

    for (
      const log of allLogs
    ) {
      uniqueLogs.set(
        `${log.transactionHash}:${log.logIndex}`,
        log
      );
    }

    const logs =
      Array.from(
        uniqueLogs.values()
      )
        .filter(
          (log) =>
            Array.isArray(
              log.topics
            ) &&
            log.topics.length >= 3
        )
        .sort(
          (a, b) =>
            fromHex(
              b.blockNumber
            ) -
            fromHex(
              a.blockNumber
            )
        )
        .slice(
          0,
          MAX_RESULTS
        );

    if (
      logs.length === 0
    ) {
      return NextResponse.json(
        []
      );
    }

    const blockNumbers =
      Array.from(
        new Set(
          logs.map(
            (log) =>
              log.blockNumber
          )
        )
      );

    const timestamps =
      new Map<
        string,
        number
      >();

    for (
      const blockNumber of blockNumbers
    ) {
      try {
        const timestamp =
          await getBlockTimestamp(
            blockNumber
          );

        timestamps.set(
          blockNumber,
          timestamp
        );

        await sleep(150);
      } catch (
        error
      ) {
        console.warn(
          `[arc transactions] Timestamp unavailable for block ${blockNumber}`,
          error
        );

        timestamps.set(
          blockNumber,
          Date.now()
        );
      }
    }

    const transactions: Transaction[] =
      logs.flatMap(
        (log) => {
          const from =
            topicAddress(
              log.topics[1]
            );

          const to =
            topicAddress(
              log.topics[2]
            );

          if (
            from === wallet &&
            to === wallet
          ) {
            return [];
          }

          let rawAmount:
            | bigint
            | null = null;

          try {
            rawAmount =
              BigInt(
                log.data ||
                  "0x0"
              );
          } catch {
            return [];
          }

          const amount =
            Number(
              formatUnits(
                rawAmount,
                USDC_DECIMALS
              )
            );

          if (
            !Number.isFinite(
              amount
            )
          ) {
            return [];
          }

          const type: Transaction["type"] =
            to === wallet
              ? "income"
              : "expense";

          const counterparty =
            type === "income"
              ? from
              : to;

          const timestamp =
            timestamps.get(
              log.blockNumber
            ) ??
            Date.now();

          return [
            {
              id:
                log.transactionHash,
              hash:
                log.transactionHash,

              name:
                shortAddress(
                  counterparty
                ),

              address:
                counterparty,

              amount:
                type === "income"
                  ? amount
                  : -amount,

              type,

              status:
                "completed",

              createdAt:
                new Date(
                  timestamp
                ).toISOString(),

              source:
                "onchain",

              blockNumber:
                fromHex(
                  log.blockNumber
                ),
            },
          ];
        }
      );

    return NextResponse.json(
      transactions,
      {
        headers: {
          "Cache-Control":
            "private, max-age=15",
        },
      }
    );
  } catch (error) {
    console.error(
      "[arc transactions]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to read Arc transactions.";

    const isRateLimit =
      message
        .toLowerCase()
        .includes(
          "rate limit"
        ) ||
      message.includes(
        "429"
      );

    return NextResponse.json(
      {
        error: message,
        retryable:
          isRateLimit,
      },
      {
        status:
          isRateLimit
            ? 429
            : 502,
      }
    );
  }
}