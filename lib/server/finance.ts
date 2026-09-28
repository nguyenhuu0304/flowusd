import type { StoredWallet } from "./db";

// Fake demo currencies + a fake "earn" product. None of this touches any
// real market data or real money — it exists purely so the demo wallet
// has something to show for Swap / Lending, the same way the rest of
// mock/db.json is simulated data.

export const SUPPORTED_CURRENCIES = ["USDC", "EURC", "USDT"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Fixed demo exchange rates (units of currency per 1 USDC). Intentionally
// static — a real integration would pull live rates from an oracle/API.
const RATE_PER_USDC: Record<SupportedCurrency, number> = {
  USDC: 1,
  EURC: 0.92,
  USDT: 1,
};

export function isSupportedCurrency(
  value: unknown
): value is SupportedCurrency {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

export function getRate(from: SupportedCurrency, to: SupportedCurrency) {
  return RATE_PER_USDC[to] / RATE_PER_USDC[from];
}

export function convert(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency
) {
  const converted = amount * getRate(from, to);
  return Math.round(converted * 1e6) / 1e6;
}

export function getCurrencyBalance(
  wallet: StoredWallet,
  currency: SupportedCurrency
): number {
  if (currency === wallet.currency) return wallet.balance;
  return wallet.balances[currency] ?? 0;
}

export function setCurrencyBalance(
  wallet: StoredWallet,
  currency: SupportedCurrency,
  value: number
) {
  const rounded = Math.round(value * 100) / 100;

  if (currency === wallet.currency) {
    wallet.balance = rounded;
  } else {
    wallet.balances[currency] = rounded;
  }
}

// Fixed demo APY — a real product would price this dynamically.
export const LENDING_APY = 4.5;

export function estimateLendingInterest(
  deposited: number,
  since: string | null
): number {
  if (!since || deposited <= 0) return 0;

  const elapsedMs = Date.now() - new Date(since).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const interest = deposited * (LENDING_APY / 100) * (elapsedDays / 365);

  return Math.round(interest * 100) / 100;
}

// Pays out interest earned so far into the main USDC balance and resets
// the accrual clock. Called before any deposit/withdrawal so the person
// always keeps whatever they've already earned.
export function settleLendingInterest(wallet: StoredWallet) {
  const interest = estimateLendingInterest(
    wallet.lending.deposited,
    wallet.lending.since
  );

  if (interest > 0) {
    setCurrencyBalance(wallet, wallet.currency as SupportedCurrency, wallet.balance + interest);
  }

  wallet.lending.since = wallet.lending.deposited > 0 ? new Date().toISOString() : null;
}

// Adds the live (not-yet-settled) accrued interest to the wallet payload
// without mutating stored state, so the UI can show an up-to-date number
// on every fetch.
export function serializeWallet(wallet: StoredWallet) {
  return {
    ...wallet,
    lending: {
      ...wallet.lending,
      accruedInterest: estimateLendingInterest(
        wallet.lending.deposited,
        wallet.lending.since
      ),
    },
  };
}
