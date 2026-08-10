import { describe, expect, it } from "vitest";
import { deriveCategory, deriveSubcategory } from "@/lib/polymarket/gamma-api";
import type { RawGammaMarket } from "@/lib/types";

function market(tags?: { label?: string; slug?: string }[]): RawGammaMarket {
  return { id: "1", conditionId: "0xcond-1", tags };
}

describe("deriveCategory", () => {
  it("returns null when tags are absent (market fetched without include_tag)", () => {
    expect(deriveCategory(market(undefined))).toBeNull();
  });

  it("returns null when tags is an empty array", () => {
    expect(deriveCategory(market([]))).toBeNull();
  });

  it("picks the canonical umbrella label out of several granular tags", () => {
    // Mirrors a real League of Legends market's live tag set.
    const m = market([
      { label: "Esports" },
      { label: "league of legends" },
      { label: "Games" },
      { label: "Sports" },
    ]);
    expect(deriveCategory(m)).toBe("Sports");
  });

  it("is case-insensitive when matching canonical categories", () => {
    const m = market([{ label: "politics" }]);
    expect(deriveCategory(m)).toBe("Politics");
  });

  it("respects canonical priority order when multiple canonical tags are present", () => {
    const m = market([{ label: "Elections" }, { label: "Sports" }]);
    expect(deriveCategory(m)).toBe("Sports");
  });

  it("falls back to the first tag label when no canonical category matches", () => {
    const m = market([{ label: "Ethiopia" }, { label: "Main Election" }]);
    expect(deriveCategory(m)).toBe("Ethiopia");
  });

  it("skips tags with no label", () => {
    const m = market([{ slug: "no-label" }, { label: "Crypto" }]);
    expect(deriveCategory(m)).toBe("Crypto");
  });
});

describe("deriveSubcategory", () => {
  it("returns null when the top category is null", () => {
    const m = market([{ label: "NFL" }]);
    expect(deriveSubcategory(m, null)).toBeNull();
  });

  it("returns null for a top category with no configured subcategory groups", () => {
    const m = market([{ label: "Weather" }, { label: "Rain" }]);
    expect(deriveSubcategory(m, "Weather")).toBeNull();
  });

  it("returns null when no tag matches a known subcategory", () => {
    const m = market([{ label: "Sports" }, { label: "Some Obscure League" }]);
    expect(deriveSubcategory(m, "Sports")).toBeNull();
  });

  it("identifies NFL, NBA, and MLB from real tag sets", () => {
    expect(deriveSubcategory(market([{ label: "Sports" }, { label: "NFL" }]), "Sports")).toBe("NFL");
    expect(deriveSubcategory(market([{ label: "Sports" }, { label: "NBA" }]), "Sports")).toBe("NBA");
    expect(
      deriveSubcategory(
        market([{ label: "MLB" }, { label: "Sports" }, { label: "baseball" }, { label: "World Series" }]),
        "Sports",
      ),
    ).toBe("MLB");
  });

  it("collapses CFB/NCAAF/college football aliases into one canonical CFB bucket", () => {
    // Real live market carried CFB + NCAAF simultaneously — must not split into two buckets.
    const m = market([
      { label: "CFB" },
      { label: "NCAAF" },
      { label: "Sports" },
      { label: "football" },
      { label: "NCAA Football" },
    ]);
    expect(deriveSubcategory(m, "Sports")).toBe("CFB");
  });

  it("is case-insensitive when matching subcategory aliases", () => {
    const m = market([{ label: "sports" }, { label: "ufc" }]);
    expect(deriveSubcategory(m, "Sports")).toBe("UFC/MMA");
  });

  it("derives non-sports subcategories (e.g. Fed under Economy)", () => {
    const m = market([{ label: "Economy" }, { label: "Fed" }]);
    expect(deriveSubcategory(m, "Economy")).toBe("Fed");
  });
});
