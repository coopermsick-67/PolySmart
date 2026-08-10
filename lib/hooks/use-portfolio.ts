"use client";

import { useCallback, useSyncExternalStore } from "react";
import { EMPTY_PORTFOLIO, PortfolioStateSchema, type PortfolioState, type Trade } from "@/lib/portfolio/types";

const STORAGE_KEY = "polymarket-smart-money:portfolio";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Cached by raw string identity so useSyncExternalStore gets a stable
// reference when the underlying localStorage value hasn't actually changed.
let cachedRaw: string | null = null;
let cachedState: PortfolioState = EMPTY_PORTFOLIO;

function getSnapshot(): PortfolioState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (!raw) {
    cachedState = EMPTY_PORTFOLIO;
    return cachedState;
  }
  try {
    const parsed = PortfolioStateSchema.safeParse(JSON.parse(raw));
    cachedState = parsed.success ? parsed.data : EMPTY_PORTFOLIO;
  } catch {
    cachedState = EMPTY_PORTFOLIO;
  }
  return cachedState;
}

function getServerSnapshot(): PortfolioState {
  return EMPTY_PORTFOLIO;
}

function writeToStorage(state: PortfolioState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can throw in private-browsing / quota-exceeded cases; non-fatal.
  }
  emitChange();
}

export function usePortfolio() {
  const portfolio = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setStartingBankroll = useCallback((amountUsd: number) => {
    const current = getSnapshot();
    writeToStorage({
      ...current,
      startingBankrollUsd: amountUsd,
      startingBankrollSetAt: new Date().toISOString(),
    });
  }, []);

  const addTrade = useCallback((trade: Trade) => {
    const current = getSnapshot();
    writeToStorage({ ...current, trades: [trade, ...current.trades] });
  }, []);

  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    const current = getSnapshot();
    writeToStorage({
      ...current,
      trades: current.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }, []);

  const deleteTrade = useCallback((id: string) => {
    const current = getSnapshot();
    writeToStorage({ ...current, trades: current.trades.filter((t) => t.id !== id) });
  }, []);

  const resetPortfolio = useCallback(() => {
    writeToStorage(EMPTY_PORTFOLIO);
  }, []);

  return { portfolio, setStartingBankroll, addTrade, updateTrade, deleteTrade, resetPortfolio };
}
