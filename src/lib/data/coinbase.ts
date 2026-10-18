import type { Candle } from '../levels/types.ts';
import { fetchJson, toNumber } from './errors.ts';

/**
 * Coinbase Exchange public candles — the fallback for crypto when Kraken is
 * unreachable. No API key.
 *
 * Two constraints shape this code:
 *   1. Max 300 candles per request, so long histories need paging.
 *   2. Granularity is limited to 60 / 300 / 900 / 3600 / 21600 / 86400 seconds,
 *      so 4h and 1w are built by aggregating smaller candles locally.
 *
 * Docs: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles
 */

const BASE_URL = 'https://api.exchange.coinbase.com/products';
const MAX_PER_REQUEST = 300;

/** Granularity we ask Coinbase for, given the window we actually want. */
export function coinbaseGranularity(desiredSeconds: number): number {
  const allowed = [60, 300, 900, 3600, 21600, 86400];
  if (allowed.includes(desiredSeconds)) return desiredSeconds;
  // 4h (14400) is not offered; 1h is the closest supported size.
  if (desiredSeconds > 3600 && desiredSeconds <= 21600) return 3600;
  if (desiredSeconds > 21600) return 86400;
  // Weekly (604800) aggregates from daily.
  return 3600;
}

interface CoinbasePage {
  candles: Candle[];
  reachedOldest: boolean;
}

/** One page. Coinbase returns [time, low, high, open, close, volume], newest first. */
async function fetchPage(product: string, granularity: number, endIso?: string): Promise<CoinbasePage> {
  const params = new URLSearchParams({ granularity: String(granularity) });
  if (endIso) params.set('end', endIso);

  const url = `${BASE_URL}/${encodeURIComponent(product)}/candles?${params.toString()}`;
  const payload = await fetchJson(url, 10_000, {
    // Coinbase rejects requests without a User-Agent.
    'user-agent': 'viwango/1.0 (educational levels app)',
  });

  if (!Array.isArray(payload)) return { candles: [], reachedOldest: true };

  const candles: Candle[] = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const time = toNumber(row[0]);
    const low = toNumber(row[1]);
    const high = toNumber(row[2]);
    const open = toNumber(row[3]);
    const close = toNumber(row[4]);
    if (time === null || open === null || high === null || low === null || close === null) continue;
    candles.push({ time, open, high, low, close });
  }

  return { candles, reachedOldest: candles.length < MAX_PER_REQUEST };
}

/**
 * Fetch up to `wanted` candles by paging backwards with `end` cursors.
 * Requests are sequential by design — the app never issues parallel upstream
 * calls, which keeps the free tiers predictable.
 */
export async function fetchCoinbaseCandles(
  product: string,
  granularitySeconds: number,
  wanted: number,
): Promise<Candle[]> {
  const granularity = coinbaseGranularity(granularitySeconds);
  const collected: Candle[] = [];
  let endIso: string | undefined;

  const pages = Math.min(4, Math.ceil(wanted / MAX_PER_REQUEST) + 1);

  for (let page = 0; page < pages; page++) {
    const { candles, reachedOldest } = await fetchPage(product, granularity, endIso);
    if (candles.length === 0) break;
    collected.push(...candles);
    if (reachedOldest) break;

    const oldest = Math.min(...candles.map((c) => c.time));
    endIso = new Date((oldest - granularity) * 1000).toISOString();
  }

  // De-duplicate (page boundaries can overlap by one candle) and sort oldest-first.
  const unique = new Map<number, Candle>();
  for (const candle of collected) unique.set(candle.time, candle);
  const sorted = [...unique.values()].sort((a, b) => a.time - b.time);

  return sorted.slice(-wanted);
}
