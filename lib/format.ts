import { DEFAULT_DECIMALS } from "./constants";

export function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: DEFAULT_DECIMALS,
    maximumFractionDigits: DEFAULT_DECIMALS,
  }).format(value);
}

export function formatNumber(
  value: number
): string {
  return new Intl.NumberFormat("en-US").format(
    value
  );
}

export function formatAddress(
  address: string
): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(
    -4
  )}`;
}

export function formatPercent(
  value: number
): string {
  return `${value.toFixed(2)}%`;
}

export function formatDate(
  date: string | Date
): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}