import { describe, expect, it } from "vitest";
import { buildEquityCurve, computeTradePnl, summarizePortfolio } from "@/lib/portfolio/calculations";
import type { PortfolioState, Trade } from "@/lib/portfolio/types";

function trade(overrides: Partial<Trade> & Pick<Trade, "status">): Trade {
  return {
    id: "t1",
    marketQuestion: "Will X happen?",
    outcome: "Yes",
    entryPriceCents: 50,
    stakeUsd: 100,
    exitPriceCents: null,
    currentPriceCents: null,
    polymarketUrl: null,
    notes: null,
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    conditionId: null,
    consensusScoreAtEntry: null,
    ...overrides,
  };
}

describe("computeTradePnl", () => {
  it("computes shares from stake and entry price", () => {
    const pnl = computeTradePnl(trade({ status: "open", stakeUsd: 100, entryPriceCents: 50 }));
    expect(pnl.shares).toBeCloseTo(200, 5); // $100 / $0.50 per share
  });

  it("won trades pay out $1/share minus cost basis", () => {
    const pnl = computeTradePnl(trade({ status: "won", stakeUsd: 100, entryPriceCents: 50 }));
    expect(pnl.realizedPnl).toBeCloseTo(100, 5); // 200 shares * $1 - $100
  });

  it("lost trades lose the full stake", () => {
    const pnl = computeTradePnl(trade({ status: "lost", stakeUsd: 100, entryPriceCents: 50 }));
    expect(pnl.realizedPnl).toBe(-100);
  });

  it("sold trades realize PnL at the exit price", () => {
    const pnl = computeTradePnl(
      trade({ status: "sold", stakeUsd: 100, entryPriceCents: 50, exitPriceCents: 70 }),
    );
    expect(pnl.realizedPnl).toBeCloseTo(40, 5); // 200 shares * $0.70 - $100
  });

  it("open trades with no current price have unknown unrealized PnL", () => {
    const pnl = computeTradePnl(trade({ status: "open" }));
    expect(pnl.realizedPnl).toBeNull();
    expect(pnl.unrealizedPnl).toBeNull();
  });

  it("open trades with a current price compute unrealized PnL", () => {
    const pnl = computeTradePnl(
      trade({ status: "open", stakeUsd: 100, entryPriceCents: 50, currentPriceCents: 60 }),
    );
    expect(pnl.unrealizedPnl).toBeCloseTo(20, 5); // 200 shares * $0.60 - $100
  });
});

describe("summarizePortfolio", () => {
  it("returns nulls/zeros for an empty portfolio", () => {
    const summary = summarizePortfolio({ startingBankrollUsd: null, startingBankrollSetAt: null, trades: [] });
    expect(summary.currentBankrollUsd).toBeNull();
    expect(summary.winRate).toBeNull();
    expect(summary.totalTrades).toBe(0);
  });

  it("derives current bankroll from starting bankroll plus realized PnL", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: "2026-01-01T00:00:00.000Z",
      trades: [
        trade({ id: "a", status: "won", stakeUsd: 100, entryPriceCents: 50 }), // +100
        trade({ id: "b", status: "lost", stakeUsd: 50, entryPriceCents: 50 }), // -50
      ],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.realizedPnl).toBeCloseTo(50, 5);
    expect(summary.currentBankrollUsd).toBeCloseTo(1050, 5);
  });

  it("computes win rate only over resolved (won/lost) trades, excluding open and sold", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: null,
      trades: [
        trade({ id: "a", status: "won" }),
        trade({ id: "b", status: "won" }),
        trade({ id: "c", status: "lost" }),
        trade({ id: "d", status: "open" }),
        trade({ id: "e", status: "sold", exitPriceCents: 60 }),
      ],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.winRate).toBeCloseTo(2 / 3, 5);
    expect(summary.openTrades).toBe(1);
    expect(summary.closedTrades).toBe(4);
  });

  it("sums unrealized PnL only from open trades with a current price", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: null,
      trades: [
        trade({ id: "a", status: "open", stakeUsd: 100, entryPriceCents: 50, currentPriceCents: 60 }),
        trade({ id: "b", status: "open" }), // no current price, contributes 0
      ],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.unrealizedPnl).toBeCloseTo(20, 5);
  });

  it("committed stake is the sum of open-trade stakes only, excluding closed trades", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: null,
      trades: [
        trade({ id: "a", status: "open", stakeUsd: 200 }),
        trade({ id: "b", status: "open", stakeUsd: 150 }),
        trade({ id: "c", status: "won", stakeUsd: 300 }), // closed — not committed anymore
      ],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.committedStakeUsd).toBe(350);
  });

  it("available bankroll excludes capital committed to open trades (the bug this fixes)", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: null,
      trades: [trade({ id: "a", status: "open", stakeUsd: 200, entryPriceCents: 50 })],
    };
    const summary = summarizePortfolio(portfolio);
    // No realized/unrealized PnL yet — but $200 is tied up in the open trade,
    // so available bankroll must be less than the full starting bankroll.
    expect(summary.availableBankrollUsd).toBe(800);
    // currentBankrollUsd (mark-to-market net worth) still counts the committed
    // capital, since it hasn't been lost — only unavailable for a new stake.
    expect(summary.currentBankrollUsd).toBe(1000);
  });

  it("available bankroll goes negative when open stakes exceed the bankroll, and is surfaced rather than hidden", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 500,
      startingBankrollSetAt: null,
      trades: [trade({ id: "a", status: "open", stakeUsd: 800 })],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.availableBankrollUsd).toBe(-300);
  });

  it("current bankroll (mark-to-market) includes unrealized PnL from open trades", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: null,
      trades: [
        trade({ id: "a", status: "open", stakeUsd: 100, entryPriceCents: 50, currentPriceCents: 70 }), // +$40 unrealized
      ],
    };
    const summary = summarizePortfolio(portfolio);
    expect(summary.currentBankrollUsd).toBeCloseTo(1040, 5);
  });
});

describe("buildEquityCurve", () => {
  it("returns an empty curve when no starting bankroll is set", () => {
    expect(buildEquityCurve({ startingBankrollUsd: null, startingBankrollSetAt: null, trades: [] })).toEqual([]);
  });

  it("starts at the starting bankroll and only moves on closed trades, in chronological order", () => {
    const portfolio: PortfolioState = {
      startingBankrollUsd: 1000,
      startingBankrollSetAt: "2026-01-01T00:00:00.000Z",
      trades: [
        trade({ id: "later", status: "won", closedAt: "2026-01-10T00:00:00.000Z", stakeUsd: 100, entryPriceCents: 50 }),
        trade({ id: "earlier", status: "lost", closedAt: "2026-01-05T00:00:00.000Z", stakeUsd: 50, entryPriceCents: 50 }),
        trade({ id: "still-open", status: "open" }),
      ],
    };
    const curve = buildEquityCurve(portfolio);
    expect(curve).toHaveLength(3); // starting point + 2 closed trades (open trade excluded)
    expect(curve[0].bankroll).toBe(1000);
    expect(curve[1].label).toBe("2026-01-05T00:00:00.000Z"); // earlier trade applied first
    expect(curve[1].bankroll).toBeCloseTo(950, 5); // 1000 - 50
    expect(curve[2].bankroll).toBeCloseTo(1050, 5); // 950 + 100
  });
});
