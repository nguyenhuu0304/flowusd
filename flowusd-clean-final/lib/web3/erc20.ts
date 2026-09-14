// Minimal, dependency-free ERC-20 ABI encoding/decoding helpers.
//
// We deliberately avoid pulling in ethers.js/viem for this: the app only
// needs two calls (balanceOf, transfer) against a single well-known
// contract, so a tiny hand-rolled encoder keeps the dependency footprint at
// zero and is easy to audit line by line.

const SELECTOR_BALANCE_OF = "0x70a08231"; // balanceOf(address)
const SELECTOR_TRANSFER = "0xa9059cbb"; // transfer(address,uint256)

function stripHexPrefix(hex: string) {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

function encodeAddress(address: string): string {
  const clean = stripHexPrefix(address).toLowerCase();

  if (!/^[0-9a-f]{40}$/.test(clean)) {
    throw new Error(`Invalid address: ${address}`);
  }

  return clean.padStart(64, "0");
}

function encodeUint256(value: bigint): string {
  if (value < BigInt(0)) {
    throw new Error("Cannot encode a negative uint256.");
  }

  return value.toString(16).padStart(64, "0");
}

export function encodeBalanceOf(address: string): string {
  return SELECTOR_BALANCE_OF + encodeAddress(address);
}

export function encodeTransfer(to: string, amount: bigint): string {
  return SELECTOR_TRANSFER + encodeAddress(to) + encodeUint256(amount);
}

export function decodeUint256(hexResult: string): bigint {
  const clean = stripHexPrefix(hexResult);

  if (!clean || /^0*$/.test(clean)) {
    return BigInt(0);
  }

  return BigInt(`0x${clean}`);
}

// Parses a human decimal string (e.g. "12.5") into a raw integer BigInt
// using string arithmetic, so we never lose precision to floating point.
export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();

  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
    throw new Error(`Invalid amount: ${value}`);
  }

  const [wholeRaw, fractionRaw = ""] = trimmed.split(".");
  const whole = wholeRaw || "0";

  const fraction = fractionRaw
    .padEnd(decimals, "0")
    .slice(0, decimals);

  const overflow = fractionRaw.slice(decimals);

  if (overflow && /[1-9]/.test(overflow)) {
    throw new Error(
      `Amount has more precision than ${decimals} decimals.`
    );
  }

  const combined = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");

  return BigInt(combined || "0");
}

// The inverse of parseUnits: turns a raw integer BigInt back into a human
// decimal string with trailing zeros trimmed.
export function formatUnits(value: bigint, decimals: number): string {
  const raw = value.toString().padStart(decimals + 1, "0");

  const whole = raw.slice(0, raw.length - decimals) || "0";
  const fraction = raw.slice(raw.length - decimals);

  const trimmedFraction = fraction.replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}
