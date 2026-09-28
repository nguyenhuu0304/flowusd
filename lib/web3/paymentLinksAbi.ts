// Minimal, dependency-free encoding helpers for the FlowUSDPaymentLinks
// contract (see /contracts/FlowUSDPaymentLinks.sol). Same philosophy as
// erc20.ts: no ethers.js/viem, just the handful of calls this app needs,
// hand-encoded so the whole request/response is easy to read line by line.

const SELECTOR_CREATE_LINK = "0xc68f51f8"; // createLink(bytes32,uint256)
const SELECTOR_PAY = "0xd0ee4de0"; // pay(bytes32,uint256)
const SELECTOR_GET_LINK = "0xf7291121"; // getLink(bytes32)

const SELECTOR_APPROVE = "0x095ea7b3"; // approve(address,uint256)
const SELECTOR_ALLOWANCE = "0xdd62ed3e"; // allowance(address,address)

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

function encodeBytes32(value: string): string {
  const clean = stripHexPrefix(value).toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error(`Invalid bytes32 value: ${value}`);
  }

  return clean;
}

// Generates a fresh, random bytes32 id in the browser using the Web
// Crypto API. Each payment link gets one of these as its on-chain
// identifier — independent from the app's internal database id.
export function generateOnChainLinkId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${hex}`;
}

export function encodeCreateLink(linkId: string, amount: bigint): string {
  return SELECTOR_CREATE_LINK + encodeBytes32(linkId) + encodeUint256(amount);
}

export function encodePay(linkId: string, amount: bigint): string {
  return SELECTOR_PAY + encodeBytes32(linkId) + encodeUint256(amount);
}

export function encodeGetLink(linkId: string): string {
  return SELECTOR_GET_LINK + encodeBytes32(linkId);
}

export function encodeApprove(spender: string, amount: bigint): string {
  return SELECTOR_APPROVE + encodeAddress(spender) + encodeUint256(amount);
}

export function encodeAllowance(owner: string, spender: string): string {
  return SELECTOR_ALLOWANCE + encodeAddress(owner) + encodeAddress(spender);
}

export type OnChainPaymentLink = {
  creator: string;
  amount: bigint;
  paid: boolean;
  payer: string;
  paidAt: bigint;
};

// Decodes getLink's (address, uint256, bool, address, uint256) return
// value. Each field occupies one 32-byte word, in order.
export function decodeGetLink(hexResult: string): OnChainPaymentLink {
  const clean = stripHexPrefix(hexResult);

  const words: string[] = [];
  for (let i = 0; i < 5; i++) {
    words.push(clean.slice(i * 64, i * 64 + 64));
  }

  const toAddress = (word: string) => `0x${word.slice(24)}`;
  const toUint = (word: string) => (word ? BigInt(`0x${word}`) : BigInt(0));
  const toBool = (word: string) => toUint(word) !== BigInt(0);

  return {
    creator: toAddress(words[0]),
    amount: toUint(words[1]),
    paid: toBool(words[2]),
    payer: toAddress(words[3]),
    paidAt: toUint(words[4]),
  };
}
