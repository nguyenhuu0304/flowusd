import { NextRequest, NextResponse } from "next/server";

import type { Transaction } from "@/types/transaction";
import {
  USDC_CONTRACT_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/web3/config";

const ARC_RPC_URL =
  process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DEFAULT_LOOKBACK = 20_000;
const LOG_CHUNK_SIZE = 2_000;
const MAX_RESULTS = 100;

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

let rpcId = 1;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpcId++,
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Arc RPC HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error.message || "Arc RPC request failed.");
  }

  return payload.result as T;
}

function toHex(value: number) {
  return `0x${Math.max(0, value).toString(16)}`;
}

function fromHex(value: string) {
  return Number.parseInt(value, 16);
}

function addressTopic(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function topicAddress(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUnits(raw: bigint, decimals: number) {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) return whole.toString();

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

async function getBlockTimestamp(blockNumber: string): Promise<number> {
  const block = await rpc<RpcBlock | null>("eth_getBlockByNumber", [
    blockNumber,
    false,
  ]);

  return block?.timestamp ? fromHex(block.timestamp) * 1000 : Date.now();
}

function validAddress(value: string | null): value is string {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!validAddress(address)) {
    return NextResponse.json(
      { error: "Invalid wallet address." },
      { status: 400 }
    );
  }

  try {
    const latestHex = await rpc<string>("eth_blockNumber");
    const latest = fromHex(latestHex);

    const configured = Number(process.env.ARC_HISTORY_LOOKBACK_BLOCKS);
    const lookback =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_LOOKBACK;

    const first = Math.max(0, latest - lookback);
    const wallet = address.toLowerCase();
    const walletTopic = addressTopic(wallet);

    const allLogs: RpcLog[] = [];

    for (let start = first; start <= latest; start += LOG_CHUNK_SIZE) {
      const end = Math.min(latest, start + LOG_CHUNK_SIZE - 1);

      const [sent, received] = await Promise.all([
        getLogs(start, end, [TRANSFER_TOPIC, walletTopic]),
        getLogs(start, end, [TRANSFER_TOPIC, null, walletTopic]),
      ]);

      allLogs.push(...sent, ...received);
    }

    const unique = new Map<string, RpcLog>();

    for (const log of allLogs) {
      unique.set(`${log.transactionHash}:${log.logIndex}`, log);
    }

    const logs = Array.from(unique.values())
      .filter((log) => log.topics.length >= 3)
      .sort((a, b) => fromHex(b.blockNumber) - fromHex(a.blockNumber))
      .slice(0, MAX_RESULTS);

    const blockNumbers = Array.from(
      new Set(logs.map((log) => log.blockNumber))
    );

    const timestampEntries = await Promise.all(
      blockNumbers.map(async (blockNumber) => [
        blockNumber,
        await getBlockTimestamp(blockNumber),
      ] as const)
    );

    const timestamps = new Map(timestampEntries);

    const transactions: Transaction[] = logs.flatMap((log) => {
      const from = topicAddress(log.topics[1]);
      const to = topicAddress(log.topics[2]);

      if (from === wallet && to === wallet) return [];

      const type: Transaction["type"] =
        to === wallet ? "income" : "expense";

      const counterparty = type === "income" ? from : to;
      const raw = BigInt(log.data || "0x0");
      const amount = Number(formatUnits(raw, USDC_DECIMALS));

      return [
        {
          id: log.transactionHash,
          hash: log.transactionHash,
          name: shortAddress(counterparty),
          address: counterparty,
          amount: type === "income" ? amount : -amount,
          type,
          status: "completed",
          createdAt: new Date(
            timestamps.get(log.blockNumber) ?? Date.now()
          ).toISOString(),
          source: "onchain",
          blockNumber: fromHex(log.blockNumber),
        },
      ];
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[arc transactions]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Arc transactions.",
      },
      { status: 502 }
    );
  }
}
