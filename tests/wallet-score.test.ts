import { describe, expect, it } from "vitest";
import { extractRedeemSamples, scoreWallet } from "@/lib/scoring/wallet-score";
import type { NormalizedPosition, RawActivity, RedeemSample } from "@/lib/types";

function position(overrides: Partial<NormalizedPosition>): NormalizedPosition {
  return {
    wallet: "0xwallet",
    conditionId: "0xcond-1",
    asset: "asset",
    marketSlug: null,
    eventSlug: null,
    eventTitle: "Event",
    marketQuestion: "Question?",
    outcome: "Yes",
    outcomeIndex: 0,
    currentProbability: 0.5,
    avgEntryPrice: 0.45,
    sizeShares: 100,
    currentValue: 500,
    cashPnl: 25,
    percentPnl: 5,
    lastActivityTs: null,
    isActiveMarket: true,
    category: "Politics",
    subCategory: null,
    endDate: null,
    ...overrides,
  };
}

describe("scoreWallet", () => {
  const now = 1_000_000;

  it("scores a diversified, fresh, well-capitalized wallet highly", () => {
    const positions = Array.from({ length: 6 }, (_, i) =>
      position({ conditionId: `0xcond-${i}`, currentValue: 5000, lastActivityTs: now - 1800 }),
    );
    const score = scoreWallet("0xwallet", positions, [], now);
    expect(score.score).toBeGreaterThan(70);
  });

  it("caps the score for a wallet with fewer than 2 active markets", () => {
    const positions = [position({ currentValue: 20000, lastActivityTs: now })];
    const score = scoreWallet("0xwallet", positions, [], now);
    expect(score.score).toBeLessThanOrEqual(40);
  });

  it("applies a concentration penalty when one position dominates exposure", () => {
    const concentrated = [
      position({ conditionId: "0xcond-a", currentValue: 9500, lastActivityTs: now }),
      position({ conditionId: "0xcond-b", currentValue: 500, lastActivityTs: now }),
    ];
    const diversified = [
      position({ conditionId: "0xcond-a", currentValue: 5000, lastActivityTs: now }),
      position({ conditionId: "0xcond-b", currentValue: 5000, lastActivityTs: now }),
    ];
    const concentratedScore = scoreWallet("0xwallet", concentrated, [], now);
    const diversifiedScore = scoreWallet("0xwallet", diversified, [], now);
    expect(diversifiedScore.score).toBeGreaterThan(concentratedScore.score);
  });

  it("scores stale positions lower than fresh ones, all else equal", () => {
    const fresh = [
      position({ conditionId: "0xcond-a", currentValue: 2000, lastActivityTs: now }),
      position({ conditionId: "0xcond-b", currentValue: 2000, lastActivityTs: now }),
    ];
    const stale = [
      position({ conditionId: "0xcond-a", currentValue: 2000, lastActivityTs: now - 30 * 24 * 3600 }),
      position({ conditionId: "0xcond-b", currentValue: 2000, lastActivityTs: now - 30 * 24 * 3600 }),
    ];
    expect(scoreWallet("0xw", fresh, [], now).score).toBeGreaterThan(scoreWallet("0xw", stale, [], now).score);
  });

  it("scores near zero for a wallet with no positions and no redeem history", () => {
    expect(scoreWallet("0xwallet", [], [], now).score).toBeLessThan(10);
  });

  it("boosts the score for a wallet with recent redeemed (won) positions", () => {
    const positions = [
      position({ conditionId: "0xcond-a", currentValue: 1000, lastActivityTs: now }),
      position({ conditionId: "0xcond-b", currentValue: 1000, lastActivityTs: now }),
    ];
    const noRedeems: RedeemSample[] = [];
    const withRedeems: RedeemSample[] = [
      { timestamp: now - 2 * 24 * 3600, usdcSize: 800 },
      { timestamp: now - 5 * 24 * 3600, usdcSize: 500 },
    ];
    const baseline = scoreWallet("0xw", positions, noRedeems, now);
    const boosted = scoreWallet("0xw", positions, withRedeems, now);
    expect(boosted.score).toBeGreaterThan(baseline.score);
    expect(boosted.recentRedeemCount).toBe(2);
    expect(boosted.recentRedeemValue).toBe(1300);
  });

  it("treats zero redeem history as neutral, not a penalty, for an otherwise identical wallet", () => {
    const positions = [
      position({ conditionId: "0xcond-a", currentValue: 1000, lastActivityTs: now }),
      position({ conditionId: "0xcond-b", currentValue: 1000, lastActivityTs: now }),
    ];
    const score = scoreWallet("0xw", positions, [], now);
    expect(score.components.realizedSignalScore).toBe(50);
  });
});

describe("extractRedeemSamples", () => {
  const now = 1_000_000;

  function activity(overrides: Partial<RawActivity>): RawActivity {
    return {
      proxyWallet: "0xwallet",
      timestamp: now,
      conditionId: "0xcond-1",
      type: "TRADE",
      ...overrides,
    };
  }

  it("extracts only REDEEM events, using usdcSize", () => {
    const samples = extractRedeemSamples([
      activity({ type: "TRADE", usdcSize: 500 }),
      activity({ type: "REDEEM", usdcSize: 250, timestamp: now - 100 }),
      activity({ type: "MERGE", usdcSize: 100 }),
    ]);
    expect(samples).toEqual([{ timestamp: now - 100, usdcSize: 250 }]);
  });

  it("is case-insensitive on the type field", () => {
    const samples = extractRedeemSamples([activity({ type: "redeem", usdcSize: 75 })]);
    expect(samples).toHaveLength(1);
  });

  it("falls back to size when usdcSize is absent", () => {
    const samples = extractRedeemSamples([activity({ type: "REDEEM", size: 42 })]);
    expect(samples[0].usdcSize).toBe(42);
  });

  it("returns an empty array when there are no REDEEM events", () => {
    expect(extractRedeemSamples([activity({ type: "TRADE" })])).toEqual([]);
  });
});
