import type { BankrollSummary, EquityCurvePoint, PortfolioState, Trade, TradePnl } from "./types";

/**
 * Computes a single trade's shares and PnL. Polymarket outcome shares pay
 * out $1 each if the outcome resolves YES for that side (`won`) and $0 if
 * it resolves the other way (`lost`); a `sold` trade exits early at
 * `exitPriceCents` instead of waiting for resolution.
 */
export function computeTradePnl(trade: Trade): TradePnl {
  const shares = trade.stakeUsd / (trade.entryPriceCents / 100);
  const costBasis = trade.stakeUsd;

  if (trade.status === "won") {
    return { shares, realizedPnl: shares * 1 - costBasis, unrealizedPnl: null, costBasis };
  }
  if (trade.status === "lost") {
    return { shares, realizedPnl: -costBasis, unrealizedPnl: null, costBasis };
  }
  if (trade.status === "sold") {
    const exitCents = trade.exitPriceCents ?? 0;
    return { shares, realizedPnl: shares * (exitCents / 100) - costBasis, unrealizedPnl: null, costBasis };
  }

  // open
  const unrealizedPnl =
    trade.currentPriceCents !== null ? shares * (trade.currentPriceCents / 100) - costBasis : null;
  return { shares, realizedPnl: null, unrealizedPnl, costBasis };
}

export function summarizePortfolio(portfolio: PortfolioState): BankrollSummary {
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let committedStakeUsd = 0;
  let wins = 0;
  let losses = 0;
  let openTrades = 0;
  let closedTrades = 0;
  let totalStaked = 0;

  for (const trade of portfolio.trades) {
    const pnl = computeTradePnl(trade);
    totalStaked += trade.stakeUsd;

    if (trade.status === "open") {
      openTrades += 1;
      committedStakeUsd += trade.stakeUsd;
      unrealizedPnl += pnl.unrealizedPnl ?? 0;
    } else {
      closedTrades += 1;
      realizedPnl += pnl.realizedPnl ?? 0;
      if (trade.status === "won") wins += 1;
      if (trade.status === "lost") losses += 1;
    }
  }

  const resolvedCount = wins + losses;
  const hasStartingBankroll = portfolio.startingBankrollUsd !== null;
  // currentBankrollUsd is mark-to-market net worth (includes committed
  // capital's current value); availableBankrollUsd is free cash you could
  // actually stake on a new trade right now. These are deliberately
  // different numbers — collapsing them into one hid how much capital was
  // already tied up in open positions.
  const currentBankrollUsd = hasStartingBankroll
    ? portfolio.startingBankrollUsd! + realizedPnl + unrealizedPnl
    : null;
  const availableBankrollUsd = hasStartingBankroll
    ? portfolio.startingBankrollUsd! + realizedPnl - committedStakeUsd
    : null;

  return {
    startingBankrollUsd: portfolio.startingBankrollUsd,
    currentBankrollUsd,
    availableBankrollUsd,
    committedStakeUsd,
    realizedPnl,
    unrealizedPnl,
    totalTrades: portfolio.trades.length,
    openTrades,
    closedTrades,
    wins,
    losses,
    winRate: resolvedCount > 0 ? wins / resolvedCount : null,
    totalStaked,
  };
}

/**
 * Cumulative bankroll over time, one point per closed trade (in
 * chronological order by `closedAt`), starting from the starting bankroll.
 * Open trades don't move the curve since their PnL isn't realized yet.
 */
export function buildEquityCurve(portfolio: PortfolioState): EquityCurvePoint[] {
  if (portfolio.startingBankrollUsd === null) return [];

  const closedTrades = portfolio.trades
    .filter((t) => t.status !== "open" && t.closedAt !== null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

  const points: EquityCurvePoint[] = [
    {
      label: portfolio.startingBankrollSetAt ?? new Date(0).toISOString(),
      bankroll: portfolio.startingBankrollUsd,
    },
  ];

  let running = portfolio.startingBankrollUsd;
  for (const trade of closedTrades) {
    const pnl = computeTradePnl(trade);
    running += pnl.realizedPnl ?? 0;
    points.push({ label: trade.closedAt!, bankroll: Math.round(running * 100) / 100 });
  }

  return points;
}
