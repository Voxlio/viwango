import type { Candle } from '../levels/types.ts';
import { fetchJson, isRecord, toNumber } from './errors.ts';

/**
 * Candle aggregation shared by the crypto sources.
 *
 * Coinbase has no 4h granularity, and neither exchange returns weekly candles
 * at the size we need, so we bucket smaller candles into a larger window:
 * open of the first candle, highest high, lowest low, close of the last one.
 * Volume is ignored because the analysis never uses it.
 *
 * Buckets are aligned to Unix epoch multiples of `bucketSeconds`, so a 4h
 * candle always starts at 00:00, 04:00, 08:00... UTC. Weekly buckets are
 * aligned to Thursday (epoch day 0 was a Thursday); that is a detail from
 * `Math.floor` on epoch seconds, not a market convention we rely on.
 */
export function aggregateCandles(candles: Candle[], bucketSeconds: number): Candle[] {
  if (bucketSeconds <= 0 || candles.length === 0) return [];

  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(bucketTime);
    if (!existing) {
      buckets.set(bucketTime, { ...candle, time: bucketTime });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close; // candles arrive oldest-first
    }
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

/** Drop the still-forming final candle some exchanges include. */
export function dropFormingCandle(candles: Candle[], nowSeconds = Math.floor(Date.now() / 1000)): Candle[] {
  if (candles.length === 0) return candles;
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const cadence = previous ? last.time - previous.time : Infinity;
  // If the newest bucket started less than one cadence ago it is still open.
  if (cadence > 0 && nowSeconds - last.time < cadence) return candles.slice(0, -1);
  return candles;
}

interface KrakenResult {
  result?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Kraken public OHLC — no API key, no rate limit worth worrying about for this
 * app (Kraken's public tier is roughly one call per second, we make at most
 * two per search and cache them).
 *
 * Response rows: [time, open, high, low, close, vwap, volume, count], newest
 * first, and the final row is the *current, unclosed* candle — it is dropped
 * because a half-formed candle produces a false high/low.
 */
export async function fetchKrakenCandles(
  pair: string,
  intervalMinutes: number,
): Promise<Candle[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${intervalMinutes}`;
  const payload = await fetchJson(url);
  if (!isRecord(payload)) return [];

  const typed = payload as KrakenResult;
  if (Array.isArray(typed.error) && typed.error.length > 0) return [];

  const result = typed.result;
  if (!isRecord(result)) return [];

  // The result key is the canonical pair name ("XXBTZUSD"), which we cannot
  // predict reliably — take the first array-valued entry that is not `last`.
  const rows = Object.entries(result).find(([key, value]) => key !== 'last' && Array.isArray(value))?.[1];
  if (!Array.isArray(rows)) return [];

  const candles: Candle[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const time = toNumber(row[0]);
    const open = toNumber(row[1]);
    const high = toNumber(row[2]);
    const low = toNumber(row[3]);
    const close = toNumber(row[4]);
    if (time === null || open === null || high === null || low === null || close === null) continue;
    candles.push({ time, open, high, low, close });
  }

  // Kraken replies newest-first; the app expects oldest-first and no live candle.
  candles.sort((a, b) => a.time - b.time);
  const closed = candles.slice(0, -1);
  return closed;
}
