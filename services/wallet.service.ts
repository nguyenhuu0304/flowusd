import { CURRENCY, NETWORK_NAME } from "@/lib/constants";
import {
  getWallet as getWalletApi,
  send as sendApi,
  swap as swapApi,
} from "@/lib/api/wallet";
import {
  depositToLending,
  withdrawFromLending,
} from "@/lib/api/lending";
import type { WalletApi, LendingPosition } from "@/lib/api/wallet";

import type { Transaction } from "@/types/transaction";

export type Wallet = {
  id?: number;
  address: string;
  balance: number;
  currency: string;
  network: string;
  balances: Record<string, number>;
  lending: LendingPosition;
};

function mapWallet(wallet: WalletApi): Wallet {
  return {
    id: wallet.id,
    address: wallet.address,
    balance: wallet.balance,
    currency: wallet.currency ?? CURRENCY,
    network: wallet.network ?? NETWORK_NAME,
    balances: wallet.balances,
    lending: wallet.lending,
  };
}

export async function getWallet(): Promise<Wallet> {
  const wallet = await getWalletApi();
  return mapWallet(wallet);
}

export async function sendMoney(data: {
  recipient: string;
  amount: number;
  memo?: string;
}): Promise<{ wallet: Wallet; transaction: Transaction }> {
  const result = await sendApi(data);

  return {
    wallet: mapWallet(result.wallet),
    transaction: result.transaction,
  };
}

export async function swapCurrency(data: {
  from: string;
  to: string;
  amount: number;
}): Promise<{ wallet: Wallet; received: number }> {
  const result = await swapApi(data);

  return {
    wallet: mapWallet(result.wallet),
    received: result.received,
  };
}

export async function depositLending(amount: number): Promise<Wallet> {
  const result = await depositToLending(amount);
  return mapWallet(result.wallet);
}

export async function withdrawLending(amount?: number): Promise<Wallet> {
  const result = await withdrawFromLending(amount);
  return mapWallet(result.wallet);
}
