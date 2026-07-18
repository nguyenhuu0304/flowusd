import { Wallet } from "@/types/wallet";

const wallet: Wallet = {
  address: "0xA91C...5F12",
  balance: 12540.25,
  currency: "USDC",
  network: "Arc",
};

export function getWallet() {
  return wallet;
}