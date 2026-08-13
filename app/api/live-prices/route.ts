import { NextRequest } from "next/server";
import { z } from "zod";
import { fetchMarketsByConditionIds } from "@/lib/polymarket/gamma-api";
import { parseOutcomesArray } from "@/lib/polymarket/gamma-api";

export const dynamic = "force-dynamic";

const LivePricesRequestSchema = z.object({
  conditionIds: z.array(z.string()).min(1).max(500),
});

export interface LiveMarketPrice {
  outcomes: string[];
  /** Current price per outcome, 0-1, aligned by index with `outcomes`. Missing/unparseable entries are omitted (never fabricated as 0). */
  prices: (number | null)[];
  closed: boolean;
}

/**
 * Live price lookup for open logged trades. Given a set of Gamma
 * conditionIds, returns each market's current outcome prices so the
 * portfolio page can mark open positions to market without the user
 * re-entering a price by hand. Best-effort: a market that fails to resolve
 * (delisted, bad ID) is simply absent from the response rather than
 * failing the whole request.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = LivePricesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request — expected { conditionIds: string[] }." }, { status: 400 });
  }

  const marketsByCondition = await fetchMarketsByConditionIds(parsed.data.conditionIds);

  const result: Record<string, LiveMarketPrice> = {};
  for (const [conditionId, market] of marketsByCondition) {
    const outcomes = parseOutcomesArray(market.outcomes);
    const rawPrices = parseOutcomesArray(market.outcomePrices);
    const prices = outcomes.map((_, i) => {
      const n = rawPrices[i] !== undefined ? Number.parseFloat(rawPrices[i]) : NaN;
      return Number.isFinite(n) ? n : null;
    });
    result[conditionId] = { outcomes, prices, closed: market.closed === true };
  }

  return Response.json(result);
}
