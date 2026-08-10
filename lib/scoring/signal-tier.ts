export type SignalTier = "Standard" | "Strong" | "High-conviction";

const HIGH_CONVICTION_THRESHOLD = 2000;
const STRONG_THRESHOLD = 500;
const STANDARD_THRESHOLD = 100;

/**
 * Classifies a single position's dollar value into a signal-strength tier.
 * Purely a size-based label for the position itself — it says nothing
 * about consensus, wallet quality, or likelihood of winning. Returns null
 * below the standard-signal floor (positions under $100 aren't shown by
 * default anyway, since that's now the app's default minimum).
 */
export function classifySignalTier(valueUsd: number): SignalTier | null {
  if (valueUsd >= HIGH_CONVICTION_THRESHOLD) return "High-conviction";
  if (valueUsd >= STRONG_THRESHOLD) return "Strong";
  if (valueUsd >= STANDARD_THRESHOLD) return "Standard";
  return null;
}

export function signalTierLabel(tier: SignalTier): string {
  return `${tier} signal`;
}
