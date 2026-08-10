import { describe, expect, it } from "vitest";
import { buildLastActivityIndex, normalizePositions } from "@/lib/polymarket/normalize";
import type { RawActivity, RawGammaMarket, RawPosition } from "@/lib/types";

function rawPosition(overrides: Partial<RawPosition> = {}): RawPosition {
  return {
    proxyWallet: "0xwallet",
    asset: "asset-1",
    conditionId: "0xcond-1",
    size: 100,
    avgPrice: 0.5,
    initialValue: 50,
    currentValue: 60,
    cashPnl: 10,
    percentPnl: 20,
    curPrice: 0.6,
    title: "Some event",
    outcome: "Yes",
    outcomeIndex: 0,
    ...overrides,
  };
}

describe("buildLastActivityIndex", () => {
  it("keeps the most recent timestamp per market", () => {
    const activity: RawActivity[] = [
      { proxyWallet: "0xw", timestamp: 100, conditionId: "0xcond-1", type: "TRADE" },
      { proxyWallet: "0xw", timestamp: 500, conditionId: "0xcond-1", type: "TRADE" },
      { proxyWallet: "0xw", timestamp: 300, conditionId: "0xcond-2", type: "TRADE" },
    ];
    const index = buildLastActivityIndex(activity);
    expect(index.get("0xcond-1")).toBe(500);
    expect(index.get("0xcond-2")).toBe(300);
  });
});

describe("normalizePositions", () => {
  it("filters out positions below the minimum value", () => {
    const positions = [rawPosition({ currentValue: 10 }), rawPosition({ currentValue: 100, conditionId: "0xcond-2" })];
    const { positions: normalized } = normalizePositions("0xwallet", positions, new Map(), new Map(), 25);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].conditionId).toBe("0xcond-2");
  });

  it("never merges Yes and No outcomes of the same market", () => {
    const positions = [
      rawPosition({ outcome: "Yes", outcomeIndex: 0, currentValue: 100 }),
      rawPosition({ outcome: "No", outcomeIndex: 1, currentValue: 100 }),
    ];
    const { positions: normalized } = normalizePositions("0xwallet", positions, new Map(), new Map(), 25);
    expect(normalized).toHaveLength(2);
    expect(new Set(normalized.map((p) => p.outcomeIndex))).toEqual(new Set([0, 1]));
  });

  it("excludes positions in markets Gamma reports as closed", () => {
    const market: RawGammaMarket = { id: "1", conditionId: "0xcond-1", closed: true, active: false };
    const positions = [rawPosition({ currentValue: 100 })];
    const { positions: normalized } = normalizePositions(
      "0xwallet",
      positions,
      new Map([["0xcond-1", market]]),
      new Map(),
      25,
    );
    expect(normalized).toHaveLength(0);
  });

  it("attaches last-activity timestamp from the activity index", () => {
    const positions = [rawPosition({ currentValue: 100 })];
    const { positions: normalized } = normalizePositions(
      "0xwallet",
      positions,
      new Map(),
      new Map([["0xcond-1", 12345]]),
      25,
    );
    expect(normalized[0].lastActivityTs).toBe(12345);
  });
});
