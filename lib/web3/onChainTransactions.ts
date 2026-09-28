import type { Transaction } from "@/types/transaction";
import type { Eip1193Provider } from "./provider";
import { USDC_CONTRACT_ADDRESS, USDC_DECIMALS } from "./config";
import { formatUnits } from "./erc20";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DEFAULT_LOOKBACK = 20_000;
const LOG_CHUNK_SIZE = 2_000;
const MAX_RESULTS = 100;

type RpcLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
};

type RpcBlock = {
  timestamp: string;
};

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

async function getLogs(
  provider: Eip1193Provider,
  fromBlock: number,
  toBlock: number,
  topics: (string | null)[]
): Promise<RpcLog[]> {
  return (await provider.request({
    method: "eth_getLogs",
    params: [
      {
        address: USDC_CONTRACT_ADDRESS,
        fromBlock: toHex(fromBlock),
        toBlock: toHex(toBlock),
        topics,
      },
    ],
  })) as RpcLog[];
}

async function getBlockTimestamp(
  provider: Eip1193Provider,
  blockNumber: string
): Promise<number> {
  const block = (await provider.request({
    method: "eth_getBlockByNumber",
    params: [blockNumber, false],
  })) as RpcBlock | null;

  return block?.timestamp ? fromHex(block.timestamp) * 1000 : Date.now();
}

export async function getOnChainUsdcTransactions(
  provider: Eip1193Provider,
  walletAddress: string
): Promise<Transaction[]> {
  const latestHex = (await provider.request({ method: "eth_blockNumber" })) as string;
  const latest = fromHex(latestHex);
  const configured = Number(process.env.NEXT_PUBLIC_ARC_HISTORY_LOOKBACK_BLOCKS);
  const lookback =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LOOKBACK;
  const first = Math.max(0, latest - lookback);
  const wallet = walletAddress.toLowerCase();
  const walletTopic = addressTopic(wallet);

  const allLogs: RpcLog[] = [];

  for (let start = first; start <= latest; start += LOG_CHUNK_SIZE) {
    const end = Math.min(latest, start + LOG_CHUNK_SIZE - 1);

    const [sent, received] = await Promise.all([
      getLogs(provider, start, end, [TRANSFER_TOPIC, walletTopic]),
      getLogs(provider, start, end, [TRANSFER_TOPIC, null, walletTopic]),
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

  const blockNumbers = Array.from(new Set(logs.map((log) => log.blockNumber)));
  const timestamps = new Map<string, number>();

  for (const blockNumber of blockNumbers) {
    timestamps.set(blockNumber, await getBlockTimestamp(provider, blockNumber));
  }

  return logs.flatMap((log): Transaction[] => {
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);

    if (from === wallet && to === wallet) return [];

    const type: Transaction["type"] = to === wallet ? "income" : "expense";
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
        createdAt: new Date(timestamps.get(log.blockNumber) ?? Date.now()).toISOString(),
        source: "onchain",
        blockNumber: fromHex(log.blockNumber),
      },
    ];
  });
}
