import { api } from "./client";
import type { TransactionApi } from "./transaction";

export type WalletApi = {
  id?: number;
  address: string;
  balance: number;
  currency: string;
  network?: string;
};

export type SendResponse = {
  wallet: WalletApi;
  transaction: TransactionApi;
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
