import { api } from "./client";
import type { TransactionApi } from "./transaction";

export type LendingPosition = {
  deposited: number;
  apy: number;
  since: string | null;
  accruedInterest: number;
};

export type WalletApi = {
  id?: number;
  address: string;
  balance: number;
  currency: string;
  network?: string;
  balances: Record<string, number>;
  lending: LendingPosition;
};

export type SendResponse = {
  wallet: WalletApi;
  transaction: TransactionApi;
};

export type SwapResponse = {
  wallet: WalletApi;
  received: number;
};

export type LendingResponse = {
  wallet: WalletApi;
};

export async function getWallet() {
  return api<WalletApi>("/wallet");
}

export async function send(data: {
  recipient: string;
  amount: number;
  memo?: string;
}) {
  return api<SendResponse>("/wallet/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function swap(data: {
  from: string;
  to: string;
  amount: number;
}) {
  return api<SwapResponse>("/wallet/swap", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
