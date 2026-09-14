// Minimal, dependency-free encoding helpers for the FlowUSDSwap contract
// (see /contracts/FlowUSDSwap.sol). Same hand-rolled approach as the rest
// of lib/web3 — no ethers.js/viem, just the calls this app needs.

const SELECTOR_SWAP_USDC_FOR_TOKEN = "0x2a9b8474"; // swapUsdcForToken(uint256)
const SELECTOR_SWAP_TOKEN_FOR_USDC = "0x729eab45"; // swapTokenForUsdc(uint256)
const SELECTOR_GET_RESERVES = "0x0902f1ac"; // getReserves()
const SELECTOR_RATE = "0x2c4e722e"; // rate()

function encodeUint256(value: bigint): string {
  if (value < BigInt(0)) {
    throw new Error("Cannot encode a negative uint256.");
  }

  return value.toString(16).padStart(64, "0");
}

export function encodeSwapUsdcForToken(usdcAmount: bigint): string {
  return SELECTOR_SWAP_USDC_FOR_TOKEN + encodeUint256(usdcAmount);
}

export function encodeSwapTokenForUsdc(tokenAmount: bigint): string {
  return SELECTOR_SWAP_TOKEN_FOR_USDC + encodeUint256(tokenAmount);
}

export function encodeGetReserves(): string {
  return SELECTOR_GET_RESERVES;
}

export function encodeRate(): string {
  return SELECTOR_RATE;
}

export type Reserves = {
  usdcReserve: bigint;
  tokenReserve: bigint;
};

// Decodes getReserves()'s (uint256, uint256) return value.
export function decodeReserves(hexResult: string): Reserves {
  const clean = hexResult.startsWith("0x") ? hexResult.slice(2) : hexResult;

  const word0 = clean.slice(0, 64);
  const word1 = clean.slice(64, 128);

  return {
    usdcReserve: word0 ? BigInt(`0x${word0}`) : BigInt(0),
    tokenReserve: word1 ? BigInt(`0x${word1}`) : BigInt(0),
  };
}

export function decodeUint256Result(hexResult: string): bigint {
  const clean = hexResult.startsWith("0x") ? hexResult.slice(2) : hexResult;
  return clean ? BigInt(`0x${clean}`) : BigInt(0);
}
