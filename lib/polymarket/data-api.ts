import { fetchJson } from "./http";
import {
  RawActivityResponseSchema,
  RawPositionsResponseSchema,
  type RawActivity,
  type RawPosition,
} from "../types";

const DATA_API_BASE = "https://data-api.polymarket.com";

/** Fetches a wallet's current positions (paginated, capped at a few pages). */
export async function fetchWalletPositions(
  wallet: string,
): Promise<RawPosition[]> {
  const positions: RawPosition[] = [];
  const limit = 500;
  let offset = 0;
  const maxPages = 4; // hard cap so one huge wallet can't stall the batch

  for (let page = 0; page < maxPages; page++) {
    const url = `${DATA_API_BASE}/positions?user=${wallet}&limit=${limit}&offset=${offset}&sizeThreshold=0`;
    const raw = await fetchJson<unknown>(url, { timeoutMs: 12_000 });
    const parsed = RawPositionsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Unexpected /positions response shape for ${wallet}: ${parsed.error.message}`,
      );
    }
    positions.push(...parsed.data);
    if (parsed.data.length < limit) break;
    offset += limit;
  }

  return positions;
}

/** Fetches a wallet's most recent activity, used to derive last-active timestamps per market. */
export async function fetchWalletActivity(
  wallet: string,
  limit = 500,
): Promise<RawActivity[]> {
  const url = `${DATA_API_BASE}/activity?user=${wallet}&limit=${limit}&sortBy=TIMESTAMP&sortDirection=DESC`;
  const raw = await fetchJson<unknown>(url, { timeoutMs: 12_000 });
  const parsed = RawActivityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Unexpected /activity response shape for ${wallet}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
