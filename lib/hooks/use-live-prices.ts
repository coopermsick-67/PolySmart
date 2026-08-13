"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trade } from "@/lib/portfolio/types";
import type { LiveMarketPrice } from "@/app/api/live-prices/route";

const DEFAULT_INTERVAL_MS = 45_000;

/**
 * Polls live Gamma prices for every open trade that was logged with a
 * conditionId (i.e. logged straight from a dashboard idea) and keeps its
 * `currentPriceCents` in sync via `updateTrade`. Manually-logged trades
 * (no conditionId) are left untouched — there's nothing to poll for them,
 * they keep the manual "Update price" flow.
 *
 * The polling effect depends on a stable key derived from
 * (id, conditionId, outcome, status) rather than the trade array itself, so
 * writing a fetched price back via updateTrade doesn't itself retrigger a
 * fresh polling cycle.
 */
export function useLiveTradePrices(
  trades: Trade[],
  updateTrade: (id: string, patch: Partial<Trade>) => void,
  options: { intervalMs?: number; enabled?: boolean } = {},
) {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tradesRef = useRef(trades);
  const updateTradeRef = useRef(updateTrade);
  useEffect(() => {
    tradesRef.current = trades;
    updateTradeRef.current = updateTrade;
  });

  const trackable = useMemo(
    () => trades.filter((t) => t.status === "open" && t.conditionId !== null),
    [trades],
  );
  const key = trackable.map((t) => `${t.id}:${t.conditionId}:${t.outcome}`).join("|");

  const refresh = useCallback(async () => {
    const current = tradesRef.current.filter((t) => t.status === "open" && t.conditionId !== null);
    if (current.length === 0) return;

    const conditionIds = Array.from(new Set(current.map((t) => t.conditionId!)));
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/live-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionIds }),
      });
      if (!res.ok) return;
      const data: Record<string, LiveMarketPrice> = await res.json();

      for (const trade of current) {
        const market = data[trade.conditionId!];
        if (!market) continue;
        const idx = market.outcomes.findIndex(
          (o) => o.trim().toLowerCase() === trade.outcome.trim().toLowerCase(),
        );
        if (idx === -1) continue;
        const price = market.prices[idx];
        if (price === null) continue;
        const cents = Math.round(price * 100 * 100) / 100;
        if (cents !== trade.currentPriceCents) {
          updateTradeRef.current(trade.id, { currentPriceCents: cents });
        }
      }
      setLastRefreshedAt(Date.now());
    } catch {
      // best-effort; a network hiccup shouldn't break the page — the next
      // interval tick (or a manual refresh) will retry.
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || trackable.length === 0) return;
    // Deferred so the effect's synchronous body never itself triggers a
    // state update — the timer callback (a macrotask) does that instead.
    const kickoff = setTimeout(refresh, 0);
    const id = setInterval(refresh, intervalMs);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, intervalMs]);

  return { lastRefreshedAt, isRefreshing, refresh, trackableCount: trackable.length };
}
