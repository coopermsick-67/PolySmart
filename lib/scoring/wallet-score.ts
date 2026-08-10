import type { NormalizedPosition, RawActivity, RedeemSample, WalletScore } from "../types";
import { recencyWeight } from "./recency";

/**
 * Wallet quality score is explicitly NOT a full measure of proven trading
 * skill. Public position data alone doesn't give us cheap access to a
 * wallet's full closed-trade history, so most of this score is built from
 * observable signals: active exposure size, number of distinct active
 * markets, how recently the wallet has been active, and how concentrated
 * its exposure is (so one whale position can't dominate the score). One
 * real piece of on-chain evidence is folded in too — recent REDEEM events
 * (see `scoreRealizedSignal`) — but that's a proxy for recent wins, not a
 * verified win rate. See methodology panel copy in the UI.
 */
export const WALLET_SCORE_BASIS_NOTE =
  "Based on position size, market diversification, recency, and recent redeemed (claimed) positions — not a verified historical win rate.";

const WEIGHTS = {
  activeValue: 0.28,
  marketCount: 0.22,
  freshness: 0.22,
  concentration: 0.18,
  realizedSignal: 0.1,
};

/** REDEEM activity events, extracted once from a wallet's raw activity feed. */
export function extractRedeemSamples(activity: RawActivity[]): RedeemSample[] {
  return activity
    .filter((a) => a.type.toUpperCase() === "REDEEM")
    .map((a) => ({ timestamp: a.timestamp, usdcSize: a.usdcSize ?? a.size ?? 0 }));
}

/**
 * log-scaled 0-100 score; $10k+ in tracked active exposure caps the score.
 * Calibrated against real Gamma/Data API sampling: most non-whale wallets
 * carry active exposure in the hundreds-to-low-thousands per market, so a
 * $50k+ cap left the vast majority of real wallets scoring near zero on this
 * component regardless of how strong their signal actually was.
 */
function scoreActiveValue(totalValue: number): number {
  const cap = 10_000;
  const score = (Math.log10(totalValue + 1) / Math.log10(cap + 1)) * 100;
  return Math.min(100, Math.max(0, score));
}

/** 10+ distinct active markets caps the score. */
function scoreMarketCount(marketCount: number): number {
  return Math.min(100, (marketCount / 10) * 100);
}

/** Mean recency weight (exponential decay) across positions, scaled to 0-100. */
function scoreFreshness(positions: NormalizedPosition[], nowSeconds: number): number {
  if (positions.length === 0) return 0;
  const totalWeight = positions.reduce(
    (sum, p) => sum + recencyWeight(p.lastActivityTs, nowSeconds),
    0,
  );
  return (totalWeight / positions.length) * 100;
}

/**
 * Herfindahl-style concentration index over position values (0 = perfectly
 * diversified, 1 = single position holds all exposure). Returned as a 0-100
 * penalty so it can be subtracted from a full-marks baseline.
 */
function concentrationPenalty(positions: NormalizedPosition[]): number {
  const total = positions.reduce((sum, p) => sum + p.currentValue, 0);
  if (total <= 0) return 100;
  const hhi = positions.reduce((sum, p) => {
    const share = p.currentValue / total;
    return sum + share * share;
  }, 0);
  // hhi ranges 1/n (fully diversified) to 1 (fully concentrated)
  return hhi * 100;
}

const REDEEM_HALF_LIFE_HOURS = 30 * 24; // redemptions are sparse vs. trades; a 2-week-old win is still meaningful
const REDEEM_VALUE_CAP = 5_000;
const REDEEM_COUNT_CAP = 3;

/**
 * Scores recent REDEEM activity (claiming payout from a resolved market) as
 * a proxy for recent wins — a rational wallet doesn't bother redeeming
 * worthless losing shares, so this is real on-chain evidence, not a guess.
 * Wallets with zero redeem history score neutral (50), not zero: it usually
 * just means nothing they hold has resolved yet, not that they're unskilled.
 */
export function scoreRealizedSignal(redeems: RedeemSample[], nowSeconds: number): number {
  if (redeems.length === 0) return 50;

  let weightedValue = 0;
  let weightedCount = 0;
  for (const r of redeems) {
    const w = recencyWeight(r.timestamp, nowSeconds, REDEEM_HALF_LIFE_HOURS);
    weightedValue += r.usdcSize * w;
    weightedCount += w;
  }

  const valueScore = Math.min(
    100,
    (Math.log10(weightedValue + 1) / Math.log10(REDEEM_VALUE_CAP + 1)) * 100,
  );
  const countScore = Math.min(100, (weightedCount / REDEEM_COUNT_CAP) * 100);

  return Math.min(100, Math.max(0, 0.6 * valueScore + 0.4 * countScore));
}

const MIN_SAMPLE_SIZE = 2;

export function scoreWallet(
  wallet: string,
  positions: NormalizedPosition[],
  redeems: RedeemSample[],
  nowSeconds: number,
): WalletScore {
  const activePositionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const activeMarketCount = new Set(positions.map((p) => p.conditionId)).size;
  const mostRecentActivityTs = positions.reduce<number | null>((max, p) => {
    if (p.lastActivityTs === null) return max;
    if (max === null) return p.lastActivityTs;
    return Math.max(max, p.lastActivityTs);
  }, null);

  const activeValueScore = scoreActiveValue(activePositionValue);
  const marketCountScore = scoreMarketCount(activeMarketCount);
  const freshnessScore = scoreFreshness(positions, nowSeconds);
  const concPenalty = concentrationPenalty(positions);
  const realizedSignalScore = scoreRealizedSignal(redeems, nowSeconds);

  let score =
    WEIGHTS.activeValue * activeValueScore +
    WEIGHTS.marketCount * marketCountScore +
    WEIGHTS.freshness * freshnessScore +
    WEIGHTS.concentration * (100 - concPenalty) +
    WEIGHTS.realizedSignal * realizedSignalScore;

  // Minimum sample-size penalty: a wallet with only one active market can't
  // demonstrate diversification, so cap its ceiling regardless of size.
  if (activeMarketCount < MIN_SAMPLE_SIZE) {
    score = Math.min(score, 40);
  }

  score = Math.min(100, Math.max(0, score));

  const recentRedeemCount = redeems.length;
  const recentRedeemValue = Math.round(redeems.reduce((sum, r) => sum + r.usdcSize, 0) * 100) / 100;

  return {
    wallet,
    score: Math.round(score * 100) / 100,
    components: {
      activeValueScore: Math.round(activeValueScore * 100) / 100,
      marketCountScore: Math.round(marketCountScore * 100) / 100,
      freshnessScore: Math.round(freshnessScore * 100) / 100,
      sampleSizeScore: activeMarketCount < MIN_SAMPLE_SIZE ? 0 : 100,
      concentrationPenalty: Math.round(concPenalty * 100) / 100,
      realizedSignalScore: Math.round(realizedSignalScore * 100) / 100,
    },
    activePositionValue: Math.round(activePositionValue * 100) / 100,
    activeMarketCount,
    mostRecentActivityTs,
    recentRedeemCount,
    recentRedeemValue,
    basisNote: WALLET_SCORE_BASIS_NOTE,
  };
}

export function scoreAllWallets(
  positionsByWallet: Map<string, NormalizedPosition[]>,
  redeemsByWallet: Map<string, RedeemSample[]>,
  nowSeconds: number,
): WalletScore[] {
  return Array.from(positionsByWallet.entries()).map(([wallet, positions]) =>
    scoreWallet(wallet, positions, redeemsByWallet.get(wallet) ?? [], nowSeconds),
  );
}
