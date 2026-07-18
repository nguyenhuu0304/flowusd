import { getWallet } from "@/services/wallet.service";

export function useWallet() {
  const wallet = getWallet();

  return {
    wallet,
  };
}