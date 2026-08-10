import { fetchJson, mapWithConcurrencyLimit } from "./http";
import { RawGammaMarketSchema, type RawGammaMarket } from "../types";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CHUNK_SIZE = 50;
const CHUNK_CONCURRENCY = 6;

/**
 * Fetches Gamma market metadata (active/closed status, liquidity, volume,
 * spread, tags, slug) for a batch of condition IDs. Chunked to keep query
 * strings reasonable, and chunks are fetched with bounded concurrency —
 * at large wallet-list scale (hundreds of distinct markets across many
 * wallets) this stage would otherwise become a sequential bottleneck.
 */
export async function fetchMarketsByConditionIds(
  conditionIds: string[],
): Promise<Map<string, RawGammaMarket>> {
  const byCondition = new Map<string, RawGammaMarket>();
  const uniqueIds = Array.from(new Set(conditionIds));

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }

  const settled = await mapWithConcurrencyLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    const params = chunk
      .map((id) => `condition_ids=${encodeURIComponent(id)}`)
      .join("&");
    const url = `${GAMMA_API_BASE}/markets?${params}&limit=${CHUNK_SIZE}&include_tag=true`;
    // Market-metadata enrichment is best-effort; a failed chunk surfaces
    // missing data downstream as UNKNOWN liquidity/status rather than
    // failing the whole run.
    return fetchJson<unknown>(url, { timeoutMs: 12_000 });
  });

  for (const result of settled) {
    if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      const parsed = RawGammaMarketSchema.safeParse(item);
      if (!parsed.success) continue;
      const conditionId = parsed.data.conditionId;
      if (conditionId) byCondition.set(conditionId, parsed.data);
    }
  }

  return byCondition;
}

// Umbrella labels Polymarket actually uses for top-nav categorization,
// in priority order. A market carries many granular tags at once (e.g. a
// League of Legends match is tagged "Esports", "league of legends", "Games",
// "Sports" all at once) — this picks the broadest one so the dashboard's
// Category filter groups by the categories a user would actually recognize.
const CANONICAL_CATEGORIES = [
  "Sports",
  "Politics",
  "Elections",
  "Crypto",
  "Economy",
  "Business",
  "Pop Culture",
  "Science",
  "Entertainment",
  "Esports",
  "Tech",
  "World",
  "Weather",
];

/**
 * Derives a single display category from a Gamma market's tags. Requires
 * the market to have been fetched with `include_tag=true` — otherwise
 * `tags` is absent and this returns null (never fabricated).
 */
export function deriveCategory(market: RawGammaMarket): string | null {
  const labels = (market.tags ?? [])
    .map((t) => t.label)
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;

  const labelSet = new Set(labels.map((l) => l.toLowerCase()));
  for (const canonical of CANONICAL_CATEGORIES) {
    if (labelSet.has(canonical.toLowerCase())) return canonical;
  }
  return labels[0];
}

// Per-category subcategory groups. Each canonical name lists the real tag
// labels Polymarket uses that should map to it, verified live against
// gamma-api.polymarket.com/events (e.g. college football markets carry
// both "CFB" and "NCAAF" tags simultaneously — they must collapse to one
// bucket, not split the same league across two subcategory filters).
const SUBCATEGORY_GROUPS: Record<string, { canonical: string; aliases: string[] }[]> = {
  Sports: [
    { canonical: "NFL", aliases: ["nfl"] },
    { canonical: "NBA", aliases: ["nba"] },
    { canonical: "WNBA", aliases: ["wnba"] },
    { canonical: "MLB", aliases: ["mlb"] },
    { canonical: "NHL", aliases: ["nhl"] },
    { canonical: "CFB", aliases: ["cfb", "ncaaf", "ncaa football", "college football"] },
    { canonical: "College Basketball", aliases: ["ncaab", "college basketball", "march madness"] },
    { canonical: "Soccer", aliases: ["soccer", "premier league", "champions league", "la liga", "fifa", "mls"] },
    { canonical: "UFC/MMA", aliases: ["ufc", "mma"] },
    { canonical: "Boxing", aliases: ["boxing"] },
    { canonical: "Tennis", aliases: ["tennis", "atp", "wta"] },
    { canonical: "Golf", aliases: ["golf", "pga"] },
    { canonical: "Formula 1", aliases: ["formula 1", "f1"] },
    { canonical: "NASCAR", aliases: ["nascar"] },
    { canonical: "Esports", aliases: ["esports", "league of legends", "lol", "cs2", "valorant", "dota 2"] },
    { canonical: "Olympics", aliases: ["olympics"] },
    { canonical: "Cricket", aliases: ["cricket"] },
    { canonical: "Rugby", aliases: ["rugby"] },
  ],
  Politics: [
    { canonical: "US Elections", aliases: ["us politics", "elections", "senate", "house", "congress"] },
    { canonical: "World Elections", aliases: ["world elections", "global elections"] },
    { canonical: "Geopolitics", aliases: ["geopolitics", "war"] },
  ],
  Crypto: [
    { canonical: "Bitcoin", aliases: ["bitcoin", "btc"] },
    { canonical: "Ethereum", aliases: ["ethereum", "eth"] },
    { canonical: "Altcoins", aliases: ["altcoins", "solana", "sol"] },
  ],
  Economy: [
    { canonical: "Fed", aliases: ["fed", "federal reserve", "interest rates"] },
    { canonical: "Inflation", aliases: ["inflation", "cpi"] },
  ],
};

/**
 * Derives a subcategory (e.g. Sports > MLB) from a market's tags, scoped to
 * its already-derived top-level category. Requires `include_tag=true` data
 * like `deriveCategory`. Returns null if the top category has no configured
 * subcategory groups, or none of its tags match a known league/topic — never
 * fabricated from an unverified guess.
 */
export function deriveSubcategory(market: RawGammaMarket, topCategory: string | null): string | null {
  if (!topCategory) return null;
  const groups = SUBCATEGORY_GROUPS[topCategory];
  if (!groups) return null;

  const labels = new Set(
    (market.tags ?? [])
      .map((t) => t.label?.toLowerCase())
      .filter((label): label is string => Boolean(label)),
  );

  for (const group of groups) {
    if (group.aliases.some((alias) => labels.has(alias))) return group.canonical;
  }
  return null;
}

export function parseNumeric(
  value: string | number | undefined | null,
): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function parseOutcomesArray(
  value: string | string[] | undefined,
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
