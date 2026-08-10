import { describe, expect, it } from "vitest";
import { buildTradeIdeas, groupByMarketAndOutcome } from "@/lib/scoring/consensus";
import type { AnalyzeRequestOptions, NormalizedPosition, RawGammaMarket, WalletScore } from "@/lib/types";

const now = Math.floor(Date.now() / 1000);

function position(overrides: Partial<NormalizedPosition> & Pick<NormalizedPosition, "wallet">): NormalizedPosition {
  return {
    conditionId: "0xcond-1",
    asset: "asset",
    marketSlug: "market-slug",
    eventSlug: "event-slug",
    eventTitle: "Will X happen?",
    marketQuestion: "Will X happen?",
    outcome: "Yes",
    outcomeIndex: 0,
    currentProbability: 0.6,
    avgEntryPrice: 0.5,
    sizeShares: 100,
    currentValue: 500,
    cashPnl: 50,
    percentPnl: 10,
    lastActivityTs: now - 3600,
    isActiveMarket: true,
    category: "Politics",
    subCategory: null,
    endDate: null,
    ...overrides,
  };
}

function walletScore(wallet: string, score: number): WalletScore {
  return {
    wallet,
    score,
    components: {
      activeValueScore: 0,
      marketCountScore: 0,
      freshnessScore: 0,
      sampleSizeScore: 0,
      concentrationPenalty: 0,
      realizedSignalScore: 50,
    },
    activePositionValue: 0,
    activeMarketCount: 0,
    mostRecentActivityTs: now,
    recentRedeemCount: 0,
    recentRedeemValue: 0,
    basisNote: "",
  };
}

const options: AnalyzeRequestOptions = { minValueUsd: 25, weighting: "quality" };
const market: RawGammaMarket = {
  id: "1",
  conditionId: "0xcond-1",
  active: true,
  closed: false,
  liquidity: "10000",
  volume: "50000",
  spread: "0.02",
  tags: [{ label: "Politics" }],
};

describe("groupByMarketAndOutcome", () => {
  it("groups positions by conditionId then outcomeIndex, never merging outcomes", () => {
    const positions = [
      position({ wallet: "0xw1", outcome: "Yes", outcomeIndex: 0 }),
      position({ wallet: "0xw2", outcome: "No", outcomeIndex: 1 }),
    ];
    const grouped = groupByMarketAndOutcome(positions);
    const byOutcome = grouped.get("0xcond-1")!;
    expect(byOutcome.size).toBe(2);
    expect(byOutcome.get(0)).toHaveLength(1);
    expect(byOutcome.get(1)).toHaveLength(1);
  });
});

describe("buildTradeIdeas", () => {
  it("requires at least two independent wallets to form an idea", () => {
    const positions = [position({ wallet: "0xw1" })];
    const ideas = buildTradeIdeas(positions, [walletScore("0xw1", 80)], new Map([["0xcond-1", market]]), options, now);
    expect(ideas).toHaveLength(0);
  });

  it("builds an idea once 2+ wallets align on the same outcome", () => {
    const positions = [
      position({ wallet: "0xw1", currentValue: 1000 }),
      position({ wallet: "0xw2", currentValue: 800 }),
    ];
    const ideas = buildTradeIdeas(
      positions,
      [walletScore("0xw1", 80), walletScore("0xw2", 70)],
      new Map([["0xcond-1", market]]),
      options,
      now,
    );
    expect(ideas).toHaveLength(1);
    expect(ideas[0].walletsAligned).toBe(2);
    expect(ideas[0].outcome).toBe("Yes");
  });

  it("detects conflicts and flags them without merging Yes/No exposure", () => {
    const positions = [
      position({ wallet: "0xw1", outcome: "Yes", outcomeIndex: 0, currentValue: 1000 }),
      position({ wallet: "0xw2", outcome: "Yes", outcomeIndex: 0, currentValue: 900 }),
      position({ wallet: "0xw3", outcome: "No", outcomeIndex: 1, currentValue: 1500 }),
      position({ wallet: "0xw4", outcome: "No", outcomeIndex: 1, currentValue: 1200 }),
    ];
    const scores = [
      walletScore("0xw1", 80),
      walletScore("0xw2", 75),
      walletScore("0xw3", 85),
      walletScore("0xw4", 60),
    ];
    const ideas = buildTradeIdeas(positions, scores, new Map([["0xcond-1", market]]), options, now);
    expect(ideas).toHaveLength(2);
    for (const idea of ideas) {
      expect(idea.riskFlags).toContain("Tracked wallets hold opposing outcomes in this market");
      expect(idea.walletsOpposed).toBe(2);
    }
  });

  it("flags markets with unknown liquidity", () => {
    const positions = [
      position({ wallet: "0xw1", currentValue: 1000 }),
      position({ wallet: "0xw2", currentValue: 900 }),
    ];
    const ideas = buildTradeIdeas(
      positions,
      [walletScore("0xw1", 80), walletScore("0xw2", 75)],
      new Map(), // no Gamma metadata available
      options,
      now,
    );
    expect(ideas[0].riskFlags).toContain("Market liquidity unknown");
  });

  it("flags stale aligned positions", () => {
    const staleTs = now - 30 * 24 * 3600;
    const positions = [
      position({ wallet: "0xw1", currentValue: 1000, lastActivityTs: staleTs }),
      position({ wallet: "0xw2", currentValue: 900, lastActivityTs: staleTs }),
    ];
    const ideas = buildTradeIdeas(
      positions,
      [walletScore("0xw1", 80), walletScore("0xw2", 75)],
      new Map([["0xcond-1", market]]),
      options,
      now,
    );
    expect(ideas[0].riskFlags).toContain("Aligned positions are stale");
  });

  it("flags markets close to resolution", () => {
    const soon = new Date((now + 6 * 3600) * 1000).toISOString();
    const positions = [
      position({ wallet: "0xw1", currentValue: 1000, endDate: soon }),
      position({ wallet: "0xw2", currentValue: 900, endDate: soon }),
    ];
    const ideas = buildTradeIdeas(
      positions,
      [walletScore("0xw1", 80), walletScore("0xw2", 75)],
      new Map([["0xcond-1", market]]),
      options,
      now,
    );
    expect(ideas[0].riskFlags).toContain("Market close to resolution — liquidity may be misleading");
  });

  it("flags idea-level whale concentration even when wallet count looks healthy (Pirates/Reds scenario)", () => {
    // Mirrors a real reported scenario: one whale-driven side (8 wallets,
    // but one dominates the dollar exposure) vs. a broader side (many
    // smaller-but-still-substantial wallets). Wallet count alone can't
    // detect this — the whale side should get flagged and penalized
    // relative to an equally-sized but evenly-distributed side.
    const whaleMarket: RawGammaMarket = { ...market, conditionId: "0xcond-whale", liquidity: "20000" };
    const evenMarket: RawGammaMarket = { ...market, conditionId: "0xcond-even", liquidity: "20000" };

    const whalePositions = [
      position({ wallet: "0xw1", conditionId: "0xcond-whale", currentValue: 9000 }),
      position({ wallet: "0xw2", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw3", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw4", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw5", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw6", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw7", conditionId: "0xcond-whale", currentValue: 150 }),
      position({ wallet: "0xw8", conditionId: "0xcond-whale", currentValue: 150 }),
    ];
    const evenPositions = Array.from({ length: 8 }, (_, i) =>
      position({ wallet: `0xe${i}`, conditionId: "0xcond-even", currentValue: 1250 }),
    );
    const scores = [
      ...whalePositions.map((p) => walletScore(p.wallet, 60)),
      ...evenPositions.map((p) => walletScore(p.wallet, 60)),
    ];

    const ideas = buildTradeIdeas(
      [...whalePositions, ...evenPositions],
      scores,
      new Map([
        ["0xcond-whale", whaleMarket],
        ["0xcond-even", evenMarket],
      ]),
      options,
      now,
    );

    const whaleIdea = ideas.find((i) => i.conditionId === "0xcond-whale")!;
    const evenIdea = ideas.find((i) => i.conditionId === "0xcond-even")!;

    expect(whaleIdea.walletsAligned).toBe(evenIdea.walletsAligned); // headcount identical
    expect(whaleIdea.concentrationHHI).toBeGreaterThan(evenIdea.concentrationHHI);
    expect(whaleIdea.riskFlags.some((f) => f.toLowerCase().includes("concentrat"))).toBe(true);
    expect(evenIdea.riskFlags.some((f) => f.toLowerCase().includes("concentrat"))).toBe(false);
    // Same total exposure and wallet count, but the whale-driven side scores
    // lower once concentration is accounted for.
    expect(whaleIdea.consensusScore).toBeLessThan(evenIdea.consensusScore);
  });

  it("weights the median entry price by exposure, not a flat per-wallet average", () => {
    const positions = [
      position({ wallet: "0xw1", currentValue: 9000, avgEntryPrice: 0.9 }), // dominant wallet entered late/high
      position({ wallet: "0xw2", currentValue: 100, avgEntryPrice: 0.1 }),
      position({ wallet: "0xw3", currentValue: 100, avgEntryPrice: 0.1 }),
    ];
    const scores = [walletScore("0xw1", 60), walletScore("0xw2", 60), walletScore("0xw3", 60)];
    const ideas = buildTradeIdeas(positions, scores, new Map([["0xcond-1", market]]), options, now);
    // An unweighted median of [0.1, 0.1, 0.9] would be 0.1 — but the dominant
    // wallet's $9,000 position should pull the weighted median toward 0.9.
    expect(ideas[0].medianEntryProbability).toBeCloseTo(0.9, 5);
  });

  it("reaches High confidence for realistic (non-whale) strong consensus", () => {
    // Modest dollar amounts and moderate wallet scores — representative of
    // typical real Polymarket wallets, not whale-scale $50k+ positions.
    // Regression guard for the fix where High confidence was unreachable on
    // real data because dollar caps were calibrated for mega-markets and the
    // confidence label re-gated on wallet count/liquidity a second time on
    // top of the already-penalized score.
    const realisticMarket: RawGammaMarket = {
      ...market,
      conditionId: "0xcond-realistic",
      liquidity: "8000",
      spread: "0.01",
    };
    const positions = [
      position({ wallet: "0xw1", conditionId: "0xcond-realistic", currentValue: 600, lastActivityTs: now - 1800 }),
      position({ wallet: "0xw2", conditionId: "0xcond-realistic", currentValue: 450, lastActivityTs: now - 3600 }),
      position({ wallet: "0xw3", conditionId: "0xcond-realistic", currentValue: 300, lastActivityTs: now - 7200 }),
    ];
    const scores = [walletScore("0xw1", 55), walletScore("0xw2", 60), walletScore("0xw3", 50)];
    const ideas = buildTradeIdeas(
      positions,
      scores,
      new Map([["0xcond-realistic", realisticMarket]]),
      options,
      now,
    );
    expect(ideas).toHaveLength(1);
    expect(ideas[0].confidence).toBe("High");
  });

  it("sorts ideas by consensus score descending", () => {
    const strongMarket: RawGammaMarket = { ...market, conditionId: "0xcond-strong", liquidity: "80000", spread: "0.005" };
    const weakMarket: RawGammaMarket = { ...market, conditionId: "0xcond-weak", liquidity: "100" };
    const positions = [
      position({ wallet: "0xw1", conditionId: "0xcond-strong", currentValue: 5000 }),
      position({ wallet: "0xw2", conditionId: "0xcond-strong", currentValue: 4000 }),
      position({ wallet: "0xw3", conditionId: "0xcond-strong", currentValue: 3000 }),
      position({ wallet: "0xw1", conditionId: "0xcond-weak", currentValue: 30 }),
      position({ wallet: "0xw2", conditionId: "0xcond-weak", currentValue: 30 }),
    ];
    const scores = [walletScore("0xw1", 90), walletScore("0xw2", 85), walletScore("0xw3", 80)];
    const ideas = buildTradeIdeas(
      positions,
      scores,
      new Map([
        ["0xcond-strong", strongMarket],
        ["0xcond-weak", weakMarket],
      ]),
      options,
      now,
    );
    expect(ideas[0].conditionId).toBe("0xcond-strong");
    expect(ideas[0].consensusScore).toBeGreaterThan(ideas[1].consensusScore);
  });
});
