export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches JSON with a timeout and exponential backoff retry on transient
 * failures (network errors, timeouts, 429, 5xx). Does not retry on 4xx
 * (other than 429) since those indicate a bad request/address.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 10_000, retries = 2, retryDelayMs = 500 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);

      if (!res.ok) {
        const retriable = res.status === 429 || res.status >= 500;
        if (retriable && attempt < retries) {
          await sleep(retryDelayMs * 2 ** attempt);
          continue;
        }
        throw new ApiError(
          `Request to ${url} failed with status ${res.status}`,
          res.status,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const isApiError = err instanceof ApiError;
      const retriable = isAbort || !isApiError;
      if (retriable && attempt < retries) {
        await sleep(retryDelayMs * 2 ** attempt);
        continue;
      }
      break;
    }
  }

  if (lastError instanceof ApiError) throw lastError;
  if (lastError instanceof DOMException && lastError.name === "AbortError") {
    throw new ApiError(`Request to ${url} timed out`);
  }
  throw new ApiError(
    `Request to ${url} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Runs async tasks with a bounded concurrency limit, preserving input order
 * in the returned settled results (never throws — each task's outcome is
 * captured individually so one failure can't abort the batch).
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}
