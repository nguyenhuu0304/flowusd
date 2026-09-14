import { type Eip1193Provider } from "./provider";
import { PAYMENT_LINKS_CONTRACT_ADDRESS, USDC_CONTRACT_ADDRESS } from "./config";
import {
  decodeGetLink,
  encodeAllowance,
  encodeApprove,
  encodeCreateLink,
  encodeGetLink,
  encodePay,
  type OnChainPaymentLink,
} from "./paymentLinksAbi";
import { decodeUint256 } from "./erc20";

export { generateOnChainLinkId } from "./paymentLinksAbi";
export type { OnChainPaymentLink };

export function isPaymentLinksContractConfigured(): boolean {
  return PAYMENT_LINKS_CONTRACT_ADDRESS.length > 0;
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

// Registers a new payment link on-chain. amountRaw is in USDC's smallest
// unit (6 decimals) — pass 0n for an "any amount" link.
export async function createLinkOnChain(
  provider: Eip1193Provider,
  from: string,
  linkId: string,
  amountRaw: bigint
): Promise<string> {
  const data = encodeCreateLink(linkId, amountRaw);
  return sendTx(provider, from, PAYMENT_LINKS_CONTRACT_ADDRESS, data);
}

// Checks how much USDC the payer has already approved the contract to
// move on their behalf.
export async function getUsdcAllowance(
  provider: Eip1193Provider,
  owner: string
): Promise<bigint> {
  const result = await ethCall(
    provider,
    USDC_CONTRACT_ADDRESS,
    encodeAllowance(owner, PAYMENT_LINKS_CONTRACT_ADDRESS)
  );

  return decodeUint256(result);
}

// One-time approval so the contract is allowed to pull `amountRaw` USDC
// from the payer's wallet when they call pay().
export async function approveUsdcForPaymentLinks(
  provider: Eip1193Provider,
  from: string,
  amountRaw: bigint
): Promise<string> {
  const data = encodeApprove(PAYMENT_LINKS_CONTRACT_ADDRESS, amountRaw);
  return sendTx(provider, from, USDC_CONTRACT_ADDRESS, data);
}

// Pays an existing link. The payer must have already approved at least
// amountRaw USDC (see approveUsdcForPaymentLinks). For a fixed-amount
// link, the contract ignores amountRaw and uses the amount set at
// creation — but we still need to pass a value here to satisfy allowance
// checks upstream.
export async function payLinkOnChain(
  provider: Eip1193Provider,
  from: string,
  linkId: string,
  amountRaw: bigint
): Promise<string> {
  const data = encodePay(linkId, amountRaw);
  return sendTx(provider, from, PAYMENT_LINKS_CONTRACT_ADDRESS, data);
}

// Reads a link's current on-chain state.
export async function getLinkOnChain(
  provider: Eip1193Provider,
  linkId: string
): Promise<OnChainPaymentLink> {
  const result = await ethCall(
    provider,
    PAYMENT_LINKS_CONTRACT_ADDRESS,
    encodeGetLink(linkId)
  );

  return decodeGetLink(result);
}
