/**
 * Suggested position sizing, tying stake to both available bankroll and
 * trade quality (consensus score). This is deliberately NOT full Kelly
 * sizing — we don't have a clean, independent estimate of true probability
 * separate from the market price to compute a real edge, so a Kelly formula
 * here would just be false precision dressed up as math. Instead this is an
 * explicit, capped risk-tier ramp: better signals get a larger suggested
 * stake, but the cap keeps any single trade — even a "perfect" 100 score —
 * from being oversized relative to the bankroll.
 */

/** Below this consensus score, no stake is suggested — the signal isn't strong enough to size against. */
const MIN_SCORE_FOR_SUGGESTION = 40;
/** Suggested stake at the minimum qualifying score. */
const MIN_STAKE_FRACTION = 0.005; // 0.5% of available bankroll
/** Suggested stake at a perfect (100) score — the hard ceiling for any single trade. */
const MAX_STAKE_FRACTION = 0.05; // 5% of available bankroll

export interface StakeSuggestion {
  stakeUsd: number;
  bankrollFraction: number; // 0-1
  tier: "none" | "small" | "moderate" | "high";
}

/**
 * Suggests a position size given free (uncommitted) bankroll and a trade's
 * consensus/confidence score (0-100). Returns null when there's no bankroll
 * on record or the score is too weak to size against at all — callers
 * should treat null as "no suggestion available," not "$0."
 */
export function suggestStake(
  availableBankrollUsd: number | null,
  consensusScore: number,
): StakeSuggestion | null {
  if (availableBankrollUsd === null || availableBankrollUsd <= 0) return null;
  if (consensusScore < MIN_SCORE_FOR_SUGGESTION) return null;

  const t = (consensusScore - MIN_SCORE_FOR_SUGGESTION) / (100 - MIN_SCORE_FOR_SUGGESTION);
  const fraction = MIN_STAKE_FRACTION + t * (MAX_STAKE_FRACTION - MIN_STAKE_FRACTION);
  const stakeUsd = Math.round(availableBankrollUsd * fraction * 100) / 100;

  const tier: StakeSuggestion["tier"] = consensusScore >= 80 ? "high" : consensusScore >= 60 ? "moderate" : "small";

  return { stakeUsd, bankrollFraction: fraction, tier };
}
