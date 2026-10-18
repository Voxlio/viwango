/**
 * A deliberately tiny in-memory cache.
 *
 * Why not a Redis/KV layer: the free tier of the upstream data provider allows
 * 8 requests per minute, and the app makes 2 per search (current + higher
 * timeframe). A 60-second cache in the serverless instance absorbs the common
 * case — one person clicking around — without any extra infrastructure. On
 * Vercel each warm Function instance gets its own Map, which is exactly the
 * scope we want.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs = 60_000, maxEntries = 200) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh insertion order so the least-recently-used entry is evicted first.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cache-through with request coalescing.
 *
 * If two requests miss the cache for the same key at the same moment, only one
 * upstream fetch runs and both await the same promise. This matters on the free
 * tier: a browser firing both the seed request and a user click would otherwise
 * burn two credits for identical data.
 */
export async function cachedFetch<T>(
  cache: TtlCache<T>,
  key: string,
  loader: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const hit = cache.get(key);
  if (hit !== undefined) return { value: hit, cached: true };

  const pendingKey = key;
  const existing = inFlight.get(pendingKey) as Promise<T> | undefined;
  if (existing) {
    const value = await existing;
    return { value, cached: true };
  }

  const task = (async () => {
    try {
      const value = await loader();
      cache.set(key, value);
      return value;
    } finally {
      inFlight.delete(pendingKey);
    }
  })();

  inFlight.set(pendingKey, task);
  const value = await task;
  return { value, cached: false };
}

/**
 * Serialises async work so provider calls never overlap.
 *
 * Twelve Data's free tier counts requests per minute regardless of concurrency,
 * so overlapping calls do not help — they just make a rate-limit spike more
 * likely. Chaining onto a single promise keeps the ordering predictable and
 * makes the "fetch sequentially" rule explicit in one place.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    // Swallow rejections on the tail so one failure cannot poison the queue.
    this.tail = next.catch(() => undefined);
    return next;
  }
}
