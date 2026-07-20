import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function truncate(
  text: string,
  start = 6,
  end = 4
) {
  if (text.length <= start + end) {
    return text;
  }

  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

export function generateId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}