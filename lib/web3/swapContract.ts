import { type Eip1193Provider } from "./provider";
import {
  SWAP_CONTRACT_ADDRESS,
  SWAP_TOKEN_ADDRESS,
  USDC_CONTRACT_ADDRESS,
} from "./config";
import {
  decodeReserves,
  decodeUint256Result,
  encodeGetReserves,
  encodeRate,
  encodeSwapTokenForUsdc,
  encodeSwapUsdcForToken,
  type Reserves,
} from "./swapAbi";
import { encodeAllowance, encodeApprove } from "./paymentLinksAbi";

export function isSwapContractConfigured(): boolean {
  return SWAP_CONTRACT_ADDRESS.length > 0 && SWAP_TOKEN_ADDRESS.length > 0;
}

async function ethCall(
  provider: Eip1193Provider,
  to: string,
  data: string
): Promise<string> {
  return (await provider.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  })) as string;
}

async function sendTx(
  provider: Eip1193Provider,
  from: string,
  to: string,
  data: string
): Promise<string> {
  return (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, value: "0x0" }],
  })) as string;
}

export async function getReserves(provider: Eip1193Provider): Promise<Reserves> {
  const result = await ethCall(provider, SWAP_CONTRACT_ADDRESS, encodeGetReserves());
  return decodeReserves(result);
}

// Rate is scaled by 1e6: rate = 2_000_000 means 1 USDC buys 2 FST.
export async function getRate(provider: Eip1193Provider): Promise<bigint> {
  const result = await ethCall(provider, SWAP_CONTRACT_ADDRESS, encodeRate());
  return decodeUint256Result(result);
}

async function getAllowance(
  provider: Eip1193Provider,
  tokenAddress: string,
  owner: string
): Promise<bigint> {
  const result = await ethCall(
    provider,
    tokenAddress,
    encodeAllowance(owner, SWAP_CONTRACT_ADDRESS)
  );
  return decodeUint256Result(result);
}

async function approveIfNeeded(
  provider: Eip1193Provider,
  tokenAddress: string,
  from: string,
  amount: bigint
): Promise<void> {
  const allowance = await getAllowance(provider, tokenAddress, from);

  if (allowance < amount) {
    const data = encodeApprove(SWAP_CONTRACT_ADDRESS, amount);
    await sendTx(provider, from, tokenAddress, data);
  }
}

// Swaps USDC -> FST. Approves USDC spending first if needed.
export async function swapUsdcForToken(
  provider: Eip1193Provider,
  from: string,
  usdcAmount: bigint
): Promise<string> {
  await approveIfNeeded(provider, USDC_CONTRACT_ADDRESS, from, usdcAmount);

  const data = encodeSwapUsdcForToken(usdcAmount);
  return sendTx(provider, from, SWAP_CONTRACT_ADDRESS, data);
}

// Swaps FST -> USDC. Approves FST spending first if needed.
export async function swapTokenForUsdc(
  provider: Eip1193Provider,
  from: string,
  tokenAmount: bigint
): Promise<string> {
  await approveIfNeeded(provider, SWAP_TOKEN_ADDRESS, from, tokenAmount);

  const data = encodeSwapTokenForUsdc(tokenAmount);
  return sendTx(provider, from, SWAP_CONTRACT_ADDRESS, data);
}

// Reads the connected wallet's FST balance (mirrors getUsdcBalance in erc20.ts).
export async function getTokenBalance(
  provider: Eip1193Provider,
  address: string
): Promise<bigint> {
  const selector = "0x70a08231"; // balanceOf(address)
  const data =
    selector + address.replace(/^0x/, "").toLowerCase().padStart(64, "0");

  const result = await ethCall(provider, SWAP_TOKEN_ADDRESS, data);
  return decodeUint256Result(result);
}
