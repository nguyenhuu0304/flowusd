import { getEthereumProvider, type Eip1193Provider } from "./provider";
import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_PARAMS,
  USDC_CONTRACT_ADDRESS,
  USDC_DECIMALS,
} from "./config";
import {
  decodeUint256,
  encodeBalanceOf,
  encodeTransfer,
  formatUnits,
  parseUnits,
} from "./erc20";

export function isMetaMaskAvailable(): boolean {
  return getEthereumProvider() !== null;
}

export async function requestAccounts(
  provider: Eip1193Provider
): Promise<string[]> {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  return accounts;
}

export async function getChainId(
  provider: Eip1193Provider
): Promise<string> {
  return (await provider.request({ method: "eth_chainId" })) as string;
}

function isChainNotAddedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 4902;
}

// Ensures the wallet is pointed at Arc Testnet, prompting the user to add
// the network if their wallet doesn't already know about it.
export async function ensureArcTestnet(
  provider: Eip1193Provider
): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (!isChainNotAddedError(error)) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [ARC_TESTNET_PARAMS],
    });
  }
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

// Reads the caller's USDC balance via the ERC-20 interface (6 decimals),
// as recommended by Arc's docs, and returns it as a display string.
export async function getUsdcBalance(
  provider: Eip1193Provider,
  address: string
): Promise<string> {
  const result = await ethCall(
    provider,
    USDC_CONTRACT_ADDRESS,
    encodeBalanceOf(address)
  );

  const raw = decodeUint256(result);

  return formatUnits(raw, USDC_DECIMALS);
}

// Sends a real (testnet) USDC transfer via the connected wallet. The
// wallet will show its own confirmation popup before anything is
// broadcast — we never hold or touch a private key ourselves.
export async function sendUsdcTransfer(
  provider: Eip1193Provider,
  from: string,
  to: string,
  amount: string
): Promise<string> {
  const raw = parseUnits(amount, USDC_DECIMALS);
  const data = encodeTransfer(to, raw);

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: USDC_CONTRACT_ADDRESS,
        data,
        value: "0x0",
      },
    ],
  })) as string;

  return txHash;
}
