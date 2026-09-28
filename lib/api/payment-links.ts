import { api } from "./client";
import type { TransactionApi } from "./transaction";
import type { WalletApi } from "./wallet";

export type PaymentLinkApi = {
  id: string;
  amount: number | null;
  memo?: string;
  status: "pending" | "paid";
  createdAt: string;
  paidAt?: string;
  payerName?: string;
};

export type PayPaymentLinkResponse = {
  wallet: WalletApi;
  transaction: TransactionApi;
  paymentLink: PaymentLinkApi;
};

export async function listPaymentLinks() {
  return api<PaymentLinkApi[]>("/payment-links");
}

export async function createPaymentLink(data: {
  amount?: number | null;
  memo?: string;
}) {
  return api<PaymentLinkApi>("/payment-links", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPaymentLink(id: string) {
  return api<PaymentLinkApi>(`/payment-links/${id}`);
}

export async function payPaymentLink(
  id: string,
  data: { amount?: number; payerName?: string }
) {
  return api<PayPaymentLinkResponse>(`/payment-links/${id}/pay`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
