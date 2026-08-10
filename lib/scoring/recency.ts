/** Half-life (hours) used for exponential recency decay across the app. */
export const RECENCY_HALF_LIFE_HOURS = 72;

/**
 * Converts a timestamp's age into a 0-1 freshness weight using exponential
 * decay: weight halves every `halfLifeHours`. A null timestamp (no known
 * activity) is treated as fully stale (0), since we can't claim freshness
 * we don't have evidence for.
 */
export function recencyWeight(
  lastActivityTs: number | null,
  nowSeconds: number,
  halfLifeHours = RECENCY_HALF_LIFE_HOURS,
): number {
  if (lastActivityTs === null) return 0;
  const ageHours = Math.max(0, (nowSeconds - lastActivityTs) / 3600);
  return Math.pow(0.5, ageHours / halfLifeHours);
}

export function ageInHours(
  lastActivityTs: number | null,
  nowSeconds: number,
): number | null {
  if (lastActivityTs === null) return null;
  return Math.max(0, (nowSeconds - lastActivityTs) / 3600);
}
