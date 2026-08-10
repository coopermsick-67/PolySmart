import type {
  AlignedWalletPosition,
  AnalyzeRequestOptions,
  ConfidenceLabel,
  NormalizedPosition,
  TradeIdea,
  WalletScore,
} from "../types";
import { extractMarketQuoteInfo, type MarketQuoteInfo } from "../polymarket/normalize";
import type { RawGammaMarket } from "../types";
import { recencyWeight } from "./recency";

// Caps are calibrated against live Gamma/Data API sampling rather than
// round guesses: most real, non-mega markets carry $1k-$60k liquidity, and
// quality-weighted aligned exposure (raw $ x wallet score, which is already
// a 0-1 fraction) rarely reaches five figures even for genuinely strong
// consensus. $100k/$50k caps left nearly everything scoring near the bottom
// of these components regardless of signal strength.
const LIQUIDITY_CAP = 40_000;
const EXPOSURE_CAP = 8_000;
const MIN_ALIGNED_WALLETS = 2;
const STALE_RECENCY_THRESHOLD = 0.15; // ~2 half-lives old
const NEAR_RESOLUTION_HOURS = 24;
const LARGE_MOVE_THRESHOLD = 0.15; // 15 probability points
const DISAGREEMENT_SHARE_THRESHOLD = 0.3;
// HHI (Herfindahl-Hirschman Index) thresholds for idea-level concentration:
// sum((wallet's share of aligned weight)^2). A perfectly even split across N
// wallets gives 1/N (e.g. 0.125 for 8 wallets); one wallet holding most of
// the exposure pushes this toward 1 regardless of how many *other* small
// wallets are also aligned. Wallet count alone can't detect this — a market
// with 8 aligned wallets where one holds 90% of the weight is materially a
// one-wallet signal wearing an 8-wallet headcount.
const HIGH_CONCENTRATION_HHI = 0.5;
const MODERATE_CONCENTRATION_HHI = 0.35;

/** Groups all normalized positions by market (conditionId), then by outcome index within it. */
export function groupByMarketAndOutcome(
  positions: NormalizedPosition[],
): Map<string, Map<number, NormalizedPosition[]>> {
  const byMarket = new Map<string, Map<number, NormalizedPosition[]>>();
  for (const p of positions) {
    let byOutcome = byMarket.get(p.conditionId);
    if (!byOutcome) {
      byOutcome = new Map();
      byMarket.set(p.conditionId, byOutcome);
    }
    const list = byOutcome.get(p.outcomeIndex) ?? [];
    list.push(p);
    byOutcome.set(p.outcomeIndex, list);
  }
  return byMarket;
}

function walletWeight(
  wallet: string,
  value: number,
  weighting: AnalyzeRequestOptions["weighting"],
  walletScores: Map<string, WalletScore>,
): number {
  if (weighting === "equal") return value;
  const quality = walletScores.get(wallet)?.score ?? 0;
  return value * (quality / 100);
}

/**
 * Weighted median: the value at which cumulative weight first reaches half
 * the total. Falls back to an even split (equivalent to a plain median) when
 * every weight is zero, so a market with only unscored wallets doesn't
 * silently return 0. Representing "where the smart money got in" by an
 * unweighted median treats a $50 tag-along position the same as a $5,000
 * quality-weighted one — this weights entries the same way the rest of the
 * scoring pipeline weights everything else.
 */
function weightedMedian(entries: { value: number; weight: number }[]): number {
  if (entries.length === 0) return 0;
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) {
    return median(entries.map((e) => e.value));
  }
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const half = totalWeight / 2;
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= half) return entry.value;
  }
  return sorted[sorted.length - 1].value;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Herfindahl-Hirschman Index over a set of weights, normalized to shares
 * that sum to 1: sum(share_i^2). Ranges from 1/N (perfectly even across N
 * participants) to 1 (one participant holds everything). Used to detect
 * when an idea's "N wallets aligned" headcount is misleading because one
 * wallet actually accounts for most of the exposure.
 */
function herfindahlIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return 0;
  return weights.reduce((sum, w) => {
    const share = w / total;
    return sum + share * share;
  }, 0);
}

function toAlignedWalletPositions(
  positions: NormalizedPosition[],
  walletScores: Map<string, WalletScore>,
): AlignedWalletPosition[] {
  return positions
    .map((p) => ({
      wallet: p.wallet,
      sizeShares: p.sizeShares,
      avgEntryPrice: p.avgEntryPrice,
      currentValue: p.currentValue,
      cashPnl: p.cashPnl,
      percentPnl: p.percentPnl,
      lastActivityTs: p.lastActivityTs,
      walletScore: walletScores.get(p.wallet)?.score ?? 0,
    }))
    .sort((a, b) => b.currentValue - a.currentValue);
}

function scoreLiquidity(quote: MarketQuoteInfo): number {
  if (quote.liquidity === null) return 30; // unknown: conservative default, not zero
  const liquidityScore =
    (Math.log10(quote.liquidity + 1) / Math.log10(LIQUIDITY_CAP + 1)) * 100;
  const spreadPenalty = quote.spread !== null && quote.spread > 0.05 ? 15 : 0;
  return Math.min(100, Math.max(0, liquidityScore - spreadPenalty));
}

export interface TradeIdeaBuildResult {
  ideas: TradeIdea[];
}

/**
 * Builds ranked trade ideas from grouped positions. Conflicts (wallets on
 * opposing outcomes of the same market) are detected here and folded into
 * both the risk flags and the agreement-score component — never silently
 * merged away.
 */
export function buildTradeIdeas(
  allPositions: NormalizedPosition[],
  walletScores: WalletScore[],
  marketsByCondition: Map<string, RawGammaMarket>,
  options: AnalyzeRequestOptions,
  nowSeconds: number,
): TradeIdea[] {
  const walletScoreMap = new Map(walletScores.map((w) => [w.wallet, w]));
  const byMarket = groupByMarketAndOutcome(allPositions);
  const ideas: TradeIdea[] = [];

  for (const [conditionId, byOutcome] of byMarket) {
    const outcomeIndices = Array.from(byOutcome.keys());
    const isConflictMarket = outcomeIndices.length > 1;

    for (const outcomeIndex of outcomeIndices) {
      const alignedPositions = byOutcome.get(outcomeIndex)!;
      const uniqueAlignedWallets = new Set(alignedPositions.map((p) => p.wallet));
      if (uniqueAlignedWallets.size < MIN_ALIGNED_WALLETS) continue;

      const opposedPositions = outcomeIndices
        .filter((idx) => idx !== outcomeIndex)
        .flatMap((idx) => byOutcome.get(idx) ?? []);

      const sample = alignedPositions[0];
      const market = marketsByCondition.get(conditionId);
      const quote = extractMarketQuoteInfo(market, sample.eventSlug, sample.marketSlug);

      const alignedWeights = alignedPositions.map((p) =>
        walletWeight(p.wallet, p.currentValue, options.weighting, walletScoreMap),
      );
      const weightedAligned = alignedWeights.reduce((sum, w) => sum + w, 0);
      const weightedOpposed = opposedPositions.reduce(
        (sum, p) => sum + walletWeight(p.wallet, p.currentValue, options.weighting, walletScoreMap),
        0,
      );
      const unweightedExposure = alignedPositions.reduce((sum, p) => sum + p.currentValue, 0);
      const concentrationHHI = herfindahlIndex(alignedWeights);

      const totalTrackedWeight = Array.from(walletScoreMap.values()).reduce(
        (sum, w) => sum + (options.weighting === "equal" ? 1 : w.score / 100),
        0,
      );
      const alignedWeightUnits = uniqueAlignedWallets.size > 0
        ? Array.from(uniqueAlignedWallets).reduce(
            (sum, w) => sum + (options.weighting === "equal" ? 1 : (walletScoreMap.get(w)?.score ?? 0) / 100),
            0,
          )
        : 0;
      const pctWeightAligned = totalTrackedWeight > 0 ? (alignedWeightUnits / totalTrackedWeight) * 100 : 0;

      const medianEntryProbability = weightedMedian(
        alignedPositions.map((p, i) => ({ value: p.avgEntryPrice, weight: alignedWeights[i] })),
      );
      const currentProbability = sample.currentProbability;
      const probabilityDelta = currentProbability - medianEntryProbability;

      const mostRecentTs = alignedPositions.reduce<number | null>((max, p) => {
        if (p.lastActivityTs === null) return max;
        if (max === null) return p.lastActivityTs;
        return Math.max(max, p.lastActivityTs);
      }, null);

      // --- component scores (0-100 each) ---
      const weightedAlignmentScore = Math.min(
        100,
        (Math.log10(weightedAligned + 1) / Math.log10(EXPOSURE_CAP + 1)) * 100,
      );
      const numWalletsScore = Math.min(100, (uniqueAlignedWallets.size / 6) * 100);
      const avgRecency =
        alignedPositions.reduce((sum, p) => sum + recencyWeight(p.lastActivityTs, nowSeconds), 0) /
        alignedPositions.length;
      const recencyScore = avgRecency * 100;
      const liquidityScore = scoreLiquidity(quote);
      const agreementScore =
        weightedAligned + weightedOpposed > 0
          ? (weightedAligned / (weightedAligned + weightedOpposed)) * 100
          : 100;

      let consensusScore =
        0.35 * weightedAlignmentScore +
        0.2 * numWalletsScore +
        0.15 * recencyScore +
        0.15 * liquidityScore +
        0.15 * agreementScore;

      // --- penalties + risk flags ---
      const riskFlags: string[] = [];
      let penalty = 0;

      if (uniqueAlignedWallets.size < 3) {
        penalty += 15;
        riskFlags.push("Fewer than 3 independent wallets aligned");
      }
      if (quote.liquidity === null) {
        penalty += 10;
        riskFlags.push("Market liquidity unknown");
      } else if (quote.liquidity < 500) {
        penalty += 15;
        riskFlags.push("Low market liquidity");
      }
      if (quote.spread !== null && quote.spread > 0.05) {
        penalty += 5;
        riskFlags.push("Wide bid/ask spread");
      }
      if (avgRecency < STALE_RECENCY_THRESHOLD) {
        penalty += 10;
        riskFlags.push("Aligned positions are stale");
      }
      if (weightedAligned + weightedOpposed > 0) {
        const opposedShare = weightedOpposed / (weightedAligned + weightedOpposed);
        if (opposedShare >= DISAGREEMENT_SHARE_THRESHOLD) {
          penalty += 15;
          riskFlags.push("Material disagreement among tracked wallets");
        }
      }
      if (Math.abs(probabilityDelta) >= LARGE_MOVE_THRESHOLD) {
        penalty += 10;
        riskFlags.push("Market has moved significantly since median entry");
      }
      if (sample.endDate) {
        const hoursToEnd = (new Date(sample.endDate).getTime() - nowSeconds * 1000) / 3_600_000;
        if (Number.isFinite(hoursToEnd) && hoursToEnd >= 0 && hoursToEnd <= NEAR_RESOLUTION_HOURS) {
          penalty += 10;
          riskFlags.push("Market close to resolution — liquidity may be misleading");
        }
      }
      if (unweightedExposure < options.minValueUsd * 3) {
        penalty += 5;
        riskFlags.push("Aggregate position size is small");
      }
      if (isConflictMarket) {
        riskFlags.push("Tracked wallets hold opposing outcomes in this market");
      }
      if (concentrationHHI >= HIGH_CONCENTRATION_HHI) {
        penalty += 12;
        riskFlags.push(
          `Exposure concentrated in one wallet — the ${uniqueAlignedWallets.size}-wallet count overstates how independent this signal is`,
        );
      } else if (concentrationHHI >= MODERATE_CONCENTRATION_HHI) {
        penalty += 6;
        riskFlags.push("Exposure moderately concentrated in a small number of wallets");
      }

      consensusScore = Math.min(100, Math.max(0, consensusScore - penalty));

      // Wallet count and liquidity are already scored (20% and 15% weight
      // respectively) and penalized directly above (unknown/low liquidity,
      // <3 wallets) — re-gating on them here as a separate hard requirement
      // double-penalizes the same signal and made "High" nearly unreachable
      // for real data. The label now reads off the already-penalized score,
      // plus one consistency check matching the wallet-count penalty
      // threshold used above (3), so the label never contradicts the score.
      let confidence: ConfidenceLabel;
      if (consensusScore >= 68 && uniqueAlignedWallets.size >= 3) {
        confidence = "High";
      } else if (consensusScore >= 40) {
        confidence = "Medium";
      } else {
        confidence = "Low";
      }

      ideas.push({
        id: `${conditionId}::${outcomeIndex}`,
        conditionId,
        marketSlug: sample.marketSlug,
        eventSlug: sample.eventSlug,
        eventTitle: sample.eventTitle,
        marketQuestion: sample.marketQuestion,
        outcome: sample.outcome,
        category: sample.category,
        subCategory: sample.subCategory,
        currentProbability,
        medianEntryProbability,
        probabilityDelta,
        consensusScore: Math.round(consensusScore * 100) / 100,
        walletsAligned: uniqueAlignedWallets.size,
        walletsOpposed: new Set(opposedPositions.map((p) => p.wallet)).size,
        weightedExposure: Math.round(weightedAligned * 100) / 100,
        unweightedExposure: Math.round(unweightedExposure * 100) / 100,
        pctWeightAligned: Math.round(pctWeightAligned * 100) / 100,
        concentrationHHI: Math.round(concentrationHHI * 1000) / 1000,
        liquidity: quote.liquidity,
        volume: quote.volume,
        spread: quote.spread,
        freshnessScore: Math.round(recencyScore * 100) / 100,
        lastActivityTs: mostRecentTs,
        confidence,
        riskFlags,
        alignedWallets: toAlignedWalletPositions(alignedPositions, walletScoreMap),
        opposedWallets: toAlignedWalletPositions(opposedPositions, walletScoreMap),
        polymarketUrl: quote.polymarketUrl,
      });
    }
  }

  return ideas.sort((a, b) => b.consensusScore - a.consensusScore);
}
