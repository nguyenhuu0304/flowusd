import { ARC_TESTNET_CHAIN_ID_HEX, USDC_CONTRACT_ADDRESS } from "@/lib/web3/config";
import { decodeGetLink, encodeGetLink, encodeAllowance, encodeApprove, encodePay, type OnChainPaymentLink } from "@/lib/web3/paymentLinksAbi";
import { decodeUint256 } from "@/lib/web3/erc20";
import type { Eip1193Provider } from "@/lib/web3/provider";

export const BATCH_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BATCH_PAYMENT_LINKS_CONTRACT_ADDRESS || "";
const BATCH_SELECTOR = "0x4df114b9"; // keccak256("batchCreateLinks(bytes32[],uint256[])")[:4]
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BYTES32 = /^0x[a-fA-F0-9]{64}$/;
const pad = (num: bigint) => num.toString(16).padStart(64, "0");
export function batchIsConfigured() { return ADDRESS.test(BATCH_CONTRACT_ADDRESS); }
export async function requireArc(provider: Eip1193Provider) {
  const id = await provider.request({ method: "eth_chainId", params: [] });
  if (String(id).toLowerCase() !== ARC_TESTNET_CHAIN_ID_HEX.toLowerCase()) throw new Error("Please switch Rabby to Arc Testnet.");
}
export function encodeBatchLinks(ids: string[], amounts: bigint[]) {
  if (ids.length < 1 || ids.length > 100 || ids.length !== amounts.length) throw new Error("Batch requires 1-100 matching links.");
  if (new Set(ids.map(x => x.toLowerCase())).size !== ids.length) throw new Error("Duplicate Link ID.");
  if (ids.some(x => !BYTES32.test(x)) || amounts.some(x => x <= 0n)) throw new Error("Invalid Link ID or USDC amount.");
  // ABI encoding: offsets for two dynamic arrays, then array length and elements.
  const first = pad(64n);
  const encodedIds = pad(BigInt(ids.length)) + ids.map(x => x.slice(2).toLowerCase()).join("");
  const secondOffset = 64n + BigInt(encodedIds.length / 2);
  const encodedAmounts = pad(BigInt(amounts.length)) + amounts.map(pad).join("");
  return BATCH_SELECTOR + first + pad(secondOffset) + encodedIds + encodedAmounts;
}
export async function readBatchLink(provider: Eip1193Provider, id: string): Promise<OnChainPaymentLink> {
  if (!batchIsConfigured() || !BYTES32.test(id)) throw new Error("Batch contract or link ID is invalid.");
  const result = await provider.request({ method: "eth_call", params: [{ to: BATCH_CONTRACT_ADDRESS, data: encodeGetLink(id) }, "latest"] });
  if (typeof result !== "string" || result.length !== 322) throw new Error("Unexpected contract response.");
  return decodeGetLink(result);
}
export async function submitBatch(provider: Eip1193Provider, creator: string, ids: string[], amounts: bigint[]) {
  await requireArc(provider);
  if (!batchIsConfigured() || !ADDRESS.test(creator)) throw new Error("Batch contract is not configured.");
  return String(await provider.request({ method: "eth_sendTransaction", params: [{ from: creator, to: BATCH_CONTRACT_ADDRESS, data: encodeBatchLinks(ids, amounts), value: "0x0" }] }));
}
export async function readUsdcAllowance(provider: Eip1193Provider, payer: string) {
  const data = await provider.request({ method: "eth_call", params: [{ to: USDC_CONTRACT_ADDRESS, data: encodeAllowance(payer, BATCH_CONTRACT_ADDRESS) }, "latest"] });
  return decodeUint256(String(data));
}
export async function approveUsdc(provider: Eip1193Provider, payer: string, amount: bigint) {
  await requireArc(provider);
  return String(await provider.request({ method: "eth_sendTransaction", params: [{ from: payer, to: USDC_CONTRACT_ADDRESS, data: encodeApprove(BATCH_CONTRACT_ADDRESS, amount), value: "0x0" }] }));
}
export async function payBatchLink(provider: Eip1193Provider, payer: string, id: string, amount: bigint) {
  await requireArc(provider);
  return String(await provider.request({ method: "eth_sendTransaction", params: [{ from: payer, to: BATCH_CONTRACT_ADDRESS, data: encodePay(id, amount), value: "0x0" }] }));
}
export async function waitForBatchReceipt(provider: Eip1193Provider, hash: string) {
  if (!BYTES32.test(hash)) throw new Error("Invalid transaction hash.");
  for (let i = 0; i < 45; i++) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string; blockNumber?: string } | null;
    if (receipt) {
      if (receipt.status === "0x1" || receipt.status === "0x01") return receipt;
      throw new Error("Transaction reverted: " + hash);
    }
    await new Promise(resolve => setTimeout(resolve, 2300));
  }
  throw new Error("Confirmation pending; do not submit again. Tx: " + hash);
}
