import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number | null, opts: { compact?: boolean } = {}): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatCents(probability: number): string {
  return `${Math.round(probability * 100)}¢`;
}

/**
 * Validates a user-supplied URL before it's ever used as an href, blocking
 * javascript:/data: injection. Only http(s) survive.
 */
export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return value;
  } catch {
    return undefined;
  }
  return undefined;
}

export function formatRelativeTime(tsSeconds: number | null, nowMs = Date.now()): string {
  if (tsSeconds === null) return "Unknown";
  const diffMs = nowMs - tsSeconds * 1000;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
