import { api } from "./client";
import type { LendingResponse } from "./wallet";

export async function depositToLending(amount: number) {
  return api<LendingResponse>("/lending/deposit", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function withdrawFromLending(amount?: number) {
  return api<LendingResponse>("/lending/withdraw", {
    method: "POST",
    body: JSON.stringify(amount !== undefined ? { amount } : {}),
  });
}
