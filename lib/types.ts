import { z } from "zod";

// ---------------------------------------------------------------------------
// Raw API response schemas (Data API / Gamma API) — only fields we use.
// ---------------------------------------------------------------------------

export const RawPositionSchema = z.object({
  proxyWallet: z.string(),
  asset: z.string(),
  conditionId: z.string(),
  size: z.number(),
  avgPrice: z.number(),
  initialValue: z.number(),
  currentValue: z.number(),
  cashPnl: z.number(),
  percentPnl: z.number(),
  totalBought: z.number().optional(),
  realizedPnl: z.number().optional(),
  percentRealizedPnl: z.number().optional(),
  curPrice: z.number(),
  redeemable: z.boolean().optional(),
  title: z.string(),
  slug: z.string().optional(),
  icon: z.string().optional(),
  eventSlug: z.string().optional(),
  outcome: z.string(),
  outcomeIndex: z.number(),
  oppositeOutcome: z.string().optional(),
  oppositeAsset: z.string().optional(),
  endDate: z.string().optional(),
  negativeRisk: z.boolean().optional(),
});
export type RawPosition = z.infer<typeof RawPositionSchema>;

export const RawPositionsResponseSchema = z.array(RawPositionSchema);

export const RawActivitySchema = z.object({
  proxyWallet: z.string(),
  timestamp: z.number(),
  conditionId: z.string(),
  type: z.string(),
  size: z.number().optional(),
  usdcSize: z.number().optional(),
  transactionHash: z.string().optional(),
  price: z.number().optional(),
  asset: z.string().optional(),
  side: z.string().optional(),
  outcomeIndex: z.number().optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  eventSlug: z.string().optional(),
  outcome: z.string().optional(),
});
export type RawActivity = z.infer<typeof RawActivitySchema>;

export const RawActivityResponseSchema = z.array(RawActivitySchema);

export const RawGammaMarketSchema = z.object({
  id: z.string(),
  conditionId: z.string().optional(),
  question: z.string().optional(),
  slug: z.string().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  archived: z.boolean().optional(),
  liquidity: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  volume24hr: z.number().optional(),
  bestBid: z.union([z.string(), z.number()]).optional(),
  bestAsk: z.union([z.string(), z.number()]).optional(),
  spread: z.union([z.string(), z.number()]).optional(),
  outcomes: z.union([z.string(), z.array(z.string())]).optional(),
  outcomePrices: z.union([z.string(), z.array(z.string())]).optional(),
  endDate: z.string().optional(),
  // Gamma's /markets endpoint has no plain `category` field (verified
  // against the live API) — real categorization lives in `tags`, which is
  // only populated when the request passes `include_tag=true`.
  tags: z
    .array(
      z.object({
        label: z.string().optional(),
        slug: z.string().optional(),
      }),
    )
    .optional(),
  events: z
    .array(
      z.object({
        id: z.string().optional(),
        slug: z.string().optional(),
        title: z.string().optional(),
      }),
    )
    .optional(),
});
export type RawGammaMarket = z.infer<typeof RawGammaMarketSchema>;

// ---------------------------------------------------------------------------
// Normalized domain types
// ---------------------------------------------------------------------------

/** A single wallet's normalized open position in one market outcome. */
export interface NormalizedPosition {
  wallet: string;
  conditionId: string;
  asset: string;
  marketSlug: string | null;
  eventSlug: string | null;
  eventTitle: string;
  marketQuestion: string;
  outcome: string;
  outcomeIndex: number;
  currentProbability: number; // 0-1
  avgEntryPrice: number; // 0-1
  sizeShares: number;
  currentValue: number; // USD
  cashPnl: number;
  percentPnl: number;
  lastActivityTs: number | null; // unix seconds, from /activity if matched
  isActiveMarket: boolean;
  category: string | null;
  subCategory: string | null;
  endDate: string | null;
}

export interface WalletLoadResult {
  wallet: string;
  status: "ok" | "error";
  error?: string;
  positionCount: number;
  filteredPositionCount: number;
}

/**
 * A REDEEM activity event (claiming payout from a resolved market). A
 * rational wallet doesn't bother redeeming worthless losing shares, so a
 * recent redemption is a cheap, legitimate proxy for a recent win — not a
 * full realized win rate, but real on-chain evidence rather than a guess.
 */
export interface RedeemSample {
  timestamp: number; // unix seconds
  usdcSize: number;
}

export interface WalletScoreComponents {
  activeValueScore: number;
  marketCountScore: number;
  freshnessScore: number;
  sampleSizeScore: number;
  concentrationPenalty: number;
  realizedSignalScore: number;
}

export interface WalletScore {
  wallet: string;
  score: number; // 0-100
  components: WalletScoreComponents;
  activePositionValue: number;
  activeMarketCount: number;
  mostRecentActivityTs: number | null;
  recentRedeemCount: number;
  recentRedeemValue: number;
  basisNote: string;
}

export type ConfidenceLabel = "High" | "Medium" | "Low";

export interface AlignedWalletPosition {
  wallet: string;
  sizeShares: number;
  avgEntryPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  lastActivityTs: number | null;
  walletScore: number;
}

export interface TradeIdea {
  id: string; // conditionId + outcome
  conditionId: string;
  marketSlug: string | null;
  eventSlug: string | null;
  eventTitle: string;
  marketQuestion: string;
  outcome: string;
  category: string | null;
  subCategory: string | null;
  currentProbability: number;
  medianEntryProbability: number;
  probabilityDelta: number;

  consensusScore: number; // 0-100
  walletsAligned: number;
  walletsOpposed: number;
  weightedExposure: number;
  unweightedExposure: number;
  pctWeightAligned: number;
  /** Herfindahl index (0-1) of aligned wallets' weighted exposure — how much one wallet dominates this idea's signal. Higher = more concentrated. */
  concentrationHHI: number;

  liquidity: number | null;
  volume: number | null;
  spread: number | null;

  freshnessScore: number; // 0-100
  lastActivityTs: number | null;

  confidence: ConfidenceLabel;
  riskFlags: string[];

  alignedWallets: AlignedWalletPosition[];
  opposedWallets: AlignedWalletPosition[];

  polymarketUrl: string | null;
}

export interface AnalysisSummary {
  walletsRequested: number;
  walletsAnalyzed: number;
  walletsLoaded: number;
  walletsFailed: number;
  activePositionsFound: number;
  activeMarketsFound: number;
  consensusIdeasFound: number;
  totalTrackedExposure: number;
  lastRefreshed: string; // ISO timestamp
}

export interface AnalyzeResponse {
  summary: AnalysisSummary;
  ideas: TradeIdea[];
  walletResults: WalletLoadResult[];
  walletScores: WalletScore[];
  validationErrors: string[];
}

export interface AnalyzeRequestOptions {
  minValueUsd: number;
  weighting: "quality" | "equal";
}

// ---------------------------------------------------------------------------
// Request validation schema
// ---------------------------------------------------------------------------

/**
 * No per-run wallet cap — analyze as many wallets as you paste. The array
 * max here is purely a sanity ceiling against malformed/malicious payloads
 * (e.g. a multi-megabyte body), not a real usage limit; ordinary lists of
 * any practical size stay far under it.
 */
export const AnalyzeRequestSchema = z.object({
  wallets: z.array(z.string()).min(1).max(20_000),
  minValueUsd: z.number().min(0).max(100000).default(100),
  weighting: z.enum(["quality", "equal"]).default("quality"),
});
export type AnalyzeRequestBody = z.infer<typeof AnalyzeRequestSchema>;
