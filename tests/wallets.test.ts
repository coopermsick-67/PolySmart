import { describe, expect, it } from "vitest";
import { dedupeWalletInput, isValidWalletAddress, parseWalletInput, shortenAddress } from "@/lib/polymarket/wallets";

describe("parseWalletInput", () => {
  it("parses newline-separated addresses", () => {
    const result = parseWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    );
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  it("parses comma-separated addresses", () => {
    const result = parseWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12,0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    );
    expect(result.valid).toHaveLength(2);
  });

  it("handles mixed newline and comma separators", () => {
    const result = parseWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12,0x2b3c4d5e6f7890abcdef1234567890abcdef1234\n0x3c4d5e6f7890abcdef1234567890abcdef123456",
    );
    expect(result.valid).toHaveLength(3);
  });

  it("flags malformed addresses as invalid without throwing", () => {
    const result = parseWalletInput("not-an-address\n0xtooshort\n0x1a2b3c4d5e6f7890abcdef1234567890abcdef12");
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toEqual(["not-an-address", "0xtooshort"]);
  });

  it("deduplicates case-insensitively and reports duplicates separately", () => {
    const result = parseWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x1A2B3C4D5E6F7890ABCDEF1234567890ABCDEF12",
    );
    expect(result.valid).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("ignores blank lines and surrounding whitespace", () => {
    const result = parseWalletInput("\n  0x1a2b3c4d5e6f7890abcdef1234567890abcdef12  \n\n");
    expect(result.valid).toEqual(["0x1a2b3c4d5e6f7890abcdef1234567890abcdef12"]);
  });

  it("returns empty buckets for empty input", () => {
    const result = parseWalletInput("");
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicates).toEqual([]);
  });
});

describe("isValidWalletAddress", () => {
  it("accepts a well-formed 0x address", () => {
    expect(isValidWalletAddress("0x1a2b3c4d5e6f7890abcdef1234567890abcdef12")).toBe(true);
  });

  it("rejects addresses of the wrong length", () => {
    expect(isValidWalletAddress("0x1a2b3c")).toBe(false);
  });

  it("rejects addresses without the 0x prefix", () => {
    expect(isValidWalletAddress("1a2b3c4d5e6f7890abcdef1234567890abcdef12")).toBe(false);
  });
});

describe("dedupeWalletInput", () => {
  it("removes case-insensitive duplicate addresses, keeping the first occurrence", () => {
    const result = dedupeWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x1A2B3C4D5E6F7890ABCDEF1234567890ABCDEF12\n0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    );
    expect(result).toBe(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    );
  });

  it("leaves invalid/malformed tokens untouched in place", () => {
    const result = dedupeWalletInput("not-an-address\n0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x1a2b3c4d5e6f7890abcdef1234567890abcdef12");
    expect(result).toBe("not-an-address\n0x1a2b3c4d5e6f7890abcdef1234567890abcdef12");
  });

  it("dedupes across comma- and newline-separated input alike", () => {
    const result = dedupeWalletInput(
      "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12,0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    );
    expect(result).toBe("0x1a2b3c4d5e6f7890abcdef1234567890abcdef12");
  });

  it("is a no-op when there are no duplicates", () => {
    const raw = "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12\n0x2b3c4d5e6f7890abcdef1234567890abcdef1234";
    expect(dedupeWalletInput(raw)).toBe(raw);
  });

  it("returns an empty string for empty input", () => {
    expect(dedupeWalletInput("")).toBe("");
  });
});

describe("shortenAddress", () => {
  it("shortens a long address", () => {
    const short = shortenAddress("0x1a2b3c4d5e6f7890abcdef1234567890abcdef12");
    expect(short).toBe("0x1a2b…ef12");
  });

  it("returns short strings unchanged", () => {
    expect(shortenAddress("0xabc")).toBe("0xabc");
  });
});
