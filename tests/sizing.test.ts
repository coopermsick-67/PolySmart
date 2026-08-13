import { describe, expect, it } from "vitest";
import { suggestStake } from "@/lib/portfolio/sizing";

describe("suggestStake", () => {
  it("returns null with no bankroll on record", () => {
    expect(suggestStake(null, 90)).toBeNull();
  });

  it("returns null for a non-positive bankroll", () => {
    expect(suggestStake(0, 90)).toBeNull();
    expect(suggestStake(-50, 90)).toBeNull();
  });

  it("returns null below the minimum qualifying score", () => {
    expect(suggestStake(1000, 39)).toBeNull();
  });

  it("sizes the minimum stake at the score threshold", () => {
    const s = suggestStake(1000, 40);
    expect(s).not.toBeNull();
    expect(s!.bankrollFraction).toBeCloseTo(0.005, 5);
    expect(s!.stakeUsd).toBeCloseTo(5, 2);
    expect(s!.tier).toBe("small");
  });

  it("caps the suggested stake at 5% of bankroll for a perfect score", () => {
    const s = suggestStake(1000, 100);
    expect(s).not.toBeNull();
    expect(s!.bankrollFraction).toBeCloseTo(0.05, 5);
    expect(s!.stakeUsd).toBeCloseTo(50, 2);
    expect(s!.tier).toBe("high");
  });

  it("scales monotonically with score between the floor and ceiling", () => {
    const low = suggestStake(1000, 45)!;
    const mid = suggestStake(1000, 65)!;
    const high = suggestStake(1000, 85)!;
    expect(low.stakeUsd).toBeLessThan(mid.stakeUsd);
    expect(mid.stakeUsd).toBeLessThan(high.stakeUsd);
  });

  it("never exceeds the 5% ceiling regardless of bankroll size", () => {
    const s = suggestStake(1_000_000, 100);
    expect(s!.stakeUsd).toBeCloseTo(50_000, 2);
    expect(s!.bankrollFraction).toBeLessThanOrEqual(0.05);
  });
});
