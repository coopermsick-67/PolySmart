"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "polymarket-smart-money:recent-wallet-lists";
const MAX_ENTRIES = 8;

export interface RecentWalletList {
  id: string;
  savedAt: string;
  walletCount: number;
  raw: string;
}

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
let cachedList: RecentWalletList[] = [];

function getSnapshot(): RecentWalletList[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedList = [];
  }
  return cachedList;
}

const EMPTY_LIST: RecentWalletList[] = [];

function getServerSnapshot(): RecentWalletList[] {
  return EMPTY_LIST;
}

function writeToStorage(lists: RecentWalletList[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // localStorage can throw in private-browsing / quota-exceeded cases; non-fatal.
  }
  emitChange();
}

export function useRecentWalletLists() {
  const lists = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const saveList = useCallback((raw: string, walletCount: number) => {
    const next: RecentWalletList[] = [
      { id: crypto.randomUUID(), savedAt: new Date().toISOString(), walletCount, raw },
      ...getSnapshot().filter((l) => l.raw !== raw),
    ].slice(0, MAX_ENTRIES);
    writeToStorage(next);
  }, []);

  const removeList = useCallback((id: string) => {
    writeToStorage(getSnapshot().filter((l) => l.id !== id));
  }, []);

  return { lists, saveList, removeList };
}
