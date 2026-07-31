import { CURRENCY, NETWORK_NAME } from "@/lib/constants";
import {
  getWallet as getWalletApi,
  send as sendApi,
} from "@/lib/api/wallet";
import type { WalletApi } from "@/lib/api/wallet";

import type { Transaction } from "@/types/transaction";

export type Wallet = {
  id?: number;
  address: string;
  balance: number;
  currency: string;
  network: string;
};

function mapWallet(wallet: WalletApi): Wallet {
  return {
    id: wallet.id,
    address: wallet.address,
    balance: wallet.balance,
    currency: wallet.currency ?? CURRENCY,
    network: wallet.network ?? NETWORK_NAME,
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
