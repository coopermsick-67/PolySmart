import { z } from "zod";

/**
 * A manually logged, self-reported trade the user made on Polymarket
 * themselves. This app never places, connects to, or auto-tracks trades —
 * every field here is entered by the user after the fact.
 */
export const TradeStatusSchema = z.enum(["open", "won", "lost", "sold"]);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

export const TradeSchema = z.object({
  id: z.string(),
  marketQuestion: z.string().min(1),
  outcome: z.string().min(1),
  entryPriceCents: z.number().min(0.01).max(99.99),
  stakeUsd: z.number().min(0.01),
  status: TradeStatusSchema,
  exitPriceCents: z.number().min(0).max(100).nullable(),
  currentPriceCents: z.number().min(0).max(100).nullable(),
  polymarketUrl: z.string().nullable(),
  notes: z.string().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  /**
   * Gamma conditionId, set only when a trade is logged straight from a
   * consensus idea on the dashboard. Enables `currentPriceCents` to be kept
   * in sync with the live market price; manually-logged trades have this
   * null and keep the old fully-manual "Update price" flow.
   */
  conditionId: z.string().nullable().default(null),
  /** Consensus score (0-100) at the moment this trade was logged, if it came from a dashboard idea. Historical — not recomputed later. */
  consensusScoreAtEntry: z.number().min(0).max(100).nullable().default(null),
});
export type Trade = z.infer<typeof TradeSchema>;

export const PortfolioStateSchema = z.object({
  startingBankrollUsd: z.number().min(0).nullable(),
  startingBankrollSetAt: z.string().nullable(),
  trades: z.array(TradeSchema),
});
export type PortfolioState = z.infer<typeof PortfolioStateSchema>;

export const EMPTY_PORTFOLIO: PortfolioState = {
  startingBankrollUsd: null,
  startingBankrollSetAt: null,
  trades: [],
};

export interface TradePnl {
  shares: number;
  realizedPnl: number | null; // null while open
  unrealizedPnl: number | null; // null unless open + currentPriceCents set
  costBasis: number;
}

export interface BankrollSummary {
  startingBankrollUsd: number | null;
  /** Mark-to-market total account value: starting + realized PnL + unrealized PnL. Null if no starting bankroll set. */
  currentBankrollUsd: number | null;
  /**
   * Free cash not tied up in any open trade — what you could actually stake
   * right now: starting + realized PnL − committed stake. This is distinct
   * from currentBankrollUsd, which still counts committed capital as part
   * of your net worth even though it isn't available to risk again.
   */
  availableBankrollUsd: number | null;
  /** Sum of stakeUsd across all open trades — capital currently at risk. */
  committedStakeUsd: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null; // null if no resolved (won/lost) trades yet
  totalStaked: number;
}

export interface EquityCurvePoint {
  label: string; // ISO date
  bankroll: number;
}
