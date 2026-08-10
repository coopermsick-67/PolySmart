import { describe, expect, it } from "vitest";
import { classifySignalTier, signalTierLabel } from "@/lib/scoring/signal-tier";

describe("classifySignalTier", () => {
  it("returns null below the $100 standard-signal floor", () => {
    expect(classifySignalTier(0)).toBeNull();
    expect(classifySignalTier(99.99)).toBeNull();
  });

  it("classifies $100-$499 as Standard", () => {
    expect(classifySignalTier(100)).toBe("Standard");
    expect(classifySignalTier(250)).toBe("Standard");
    expect(classifySignalTier(499.99)).toBe("Standard");
  });

  it("classifies $500-$1,999 as Strong", () => {
    expect(classifySignalTier(500)).toBe("Strong");
    expect(classifySignalTier(1000)).toBe("Strong");
    expect(classifySignalTier(1999.99)).toBe("Strong");
  });

  it("classifies $2,000+ as High-conviction", () => {
    expect(classifySignalTier(2000)).toBe("High-conviction");
    expect(classifySignalTier(50_000)).toBe("High-conviction");
  });
});

describe("signalTierLabel", () => {
  it("appends 'signal' to the tier name", () => {
    expect(signalTierLabel("Standard")).toBe("Standard signal");
    expect(signalTierLabel("High-conviction")).toBe("High-conviction signal");
  });
});
