import { describe, expect, it } from "vitest";
import { ageInHours, recencyWeight, RECENCY_HALF_LIFE_HOURS } from "@/lib/scoring/recency";

describe("recencyWeight", () => {
  const now = 1_000_000;

  it("returns 1 for activity at the current moment", () => {
    expect(recencyWeight(now, now)).toBeCloseTo(1, 5);
  });

  it("returns 0.5 after exactly one half-life", () => {
    const ts = now - RECENCY_HALF_LIFE_HOURS * 3600;
    expect(recencyWeight(ts, now)).toBeCloseTo(0.5, 5);
  });

  it("returns 0.25 after two half-lives", () => {
    const ts = now - RECENCY_HALF_LIFE_HOURS * 3600 * 2;
    expect(recencyWeight(ts, now)).toBeCloseTo(0.25, 5);
  });

  it("returns 0 for a null timestamp", () => {
    expect(recencyWeight(null, now)).toBe(0);
  });

  it("never returns a negative weight for future timestamps (clock skew)", () => {
    expect(recencyWeight(now + 1000, now)).toBeLessThanOrEqual(1);
  });
});

describe("ageInHours", () => {
  it("computes the age in hours", () => {
    const now = 1_000_000;
    expect(ageInHours(now - 3600, now)).toBeCloseTo(1, 5);
  });

  it("returns null for a null timestamp", () => {
    expect(ageInHours(null, 1_000_000)).toBeNull();
  });
});
