import type { RawActivity, RawGammaMarket, RawPosition, NormalizedPosition } from "../types";
import { deriveCategory, deriveSubcategory, parseNumeric } from "./gamma-api";

/**
 * Builds a per-wallet map of conditionId -> most recent activity timestamp
 * (seconds), used to derive position freshness since /positions has no
 * last-touched field of its own.
 */
export function buildLastActivityIndex(
  activity: RawActivity[],
): Map<string, number> {
  const index = new Map<string, number>();
  for (const entry of activity) {
    const existing = index.get(entry.conditionId);
    if (!existing || entry.timestamp > existing) {
      index.set(entry.conditionId, entry.timestamp);
    }
  }
  return index;
}

/**
 * Converts raw /positions rows into normalized positions, filtering out
 * anything below `minValueUsd` and enriching with Gamma market status
 * (active/closed) and last-activity timestamps.
 *
 * Yes/No (and other outcome indices) are never merged — each outcome index
 * within a conditionId remains a distinct row so opposing directional bets
 * are never collapsed into one.
 */
export function normalizePositions(
  wallet: string,
  rawPositions: RawPosition[],
  marketsByCondition: Map<string, RawGammaMarket>,
  lastActivityByCondition: Map<string, number>,
  minValueUsd: number,
): { positions: NormalizedPosition[]; totalRawCount: number } {
  const positions: NormalizedPosition[] = [];

  for (const raw of rawPositions) {
    if (raw.currentValue < minValueUsd) continue;

    const market = marketsByCondition.get(raw.conditionId);
    const isActiveMarket = market
      ? market.active === true && market.closed !== true
      : true; // unknown status: don't silently drop, but don't claim it's "confirmed active" either

    if (market && market.closed === true) continue;

    const category = market ? deriveCategory(market) : null;

    positions.push({
      wallet,
      conditionId: raw.conditionId,
      asset: raw.asset,
      marketSlug: raw.slug ?? market?.slug ?? null,
      eventSlug: raw.eventSlug ?? null,
      eventTitle: raw.title,
      marketQuestion: market?.question ?? raw.title,
      outcome: raw.outcome,
      outcomeIndex: raw.outcomeIndex,
      currentProbability: raw.curPrice,
      avgEntryPrice: raw.avgPrice,
      sizeShares: raw.size,
      currentValue: raw.currentValue,
      cashPnl: raw.cashPnl,
      percentPnl: raw.percentPnl,
      lastActivityTs: lastActivityByCondition.get(raw.conditionId) ?? null,
      isActiveMarket,
      category,
      subCategory: market ? deriveSubcategory(market, category) : null,
      endDate: raw.endDate ?? market?.endDate ?? null,
    });
  }

  return { positions, totalRawCount: rawPositions.length };
}

export interface MarketQuoteInfo {
  liquidity: number | null;
  volume: number | null;
  spread: number | null;
  polymarketUrl: string | null;
}

export function extractMarketQuoteInfo(
  market: RawGammaMarket | undefined,
  eventSlug: string | null,
  marketSlug: string | null,
): MarketQuoteInfo {
  const liquidity = parseNumeric(market?.liquidity);
  const volume = parseNumeric(market?.volume);
  const spread = parseNumeric(market?.spread);
  const slugForUrl = eventSlug ?? marketSlug ?? market?.slug ?? null;
  const polymarketUrl = slugForUrl
    ? `https://polymarket.com/event/${slugForUrl}`
    : null;
  return { liquidity, volume, spread, polymarketUrl };
}
