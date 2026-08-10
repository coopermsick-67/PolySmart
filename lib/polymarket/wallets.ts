const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export interface ParsedWallets {
  valid: string[]; // de-duplicated, lowercased, in first-seen order
  invalid: string[]; // original malformed tokens, in first-seen order
  duplicates: string[]; // original tokens that repeated a prior valid entry
}

/**
 * Parses a wallet-list textarea value into valid/invalid/duplicate buckets.
 * Accepts newline- and/or comma-separated Polygon addresses (0x + 40 hex chars).
 */
export function parseWalletInput(raw: string): ParsedWallets {
  const tokens = raw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (!ADDRESS_RE.test(token)) {
      invalid.push(token);
      continue;
    }
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) {
      duplicates.push(token);
      continue;
    }
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicates };
}

/**
 * Rewrites a wallet-list textarea value with exact-duplicate addresses
 * removed (case-insensitive, first occurrence kept). Invalid/malformed
 * tokens are left untouched, in place, so the user can still see and fix
 * them — this only removes true duplicates of a valid address.
 */
export function dedupeWalletInput(raw: string): string {
  const tokens = raw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set<string>();
  const output: string[] = [];

  for (const token of tokens) {
    if (!ADDRESS_RE.test(token)) {
      output.push(token);
      continue;
    }
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(token);
  }

  return output.join("\n");
}

export function isValidWalletAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
