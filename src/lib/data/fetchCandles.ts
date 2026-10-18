import type { Candle } from '../levels/types.ts';
import type { SymbolConfig } from '../symbols.ts';
import { configFor, type ConfluenceTimeframe, type Timeframe } from '../timeframes.ts';
import { TtlCache, SerialQueue, cachedFetch } from './cache.ts';
import { DataError, errors } from './errors.ts';
import { fetchTwelveDataCandles } from './twelveData.ts';
import { fetchKrakenCandles, aggregateCandles } from './kraken.ts';
import { fetchCoinbaseCandles, coinbaseGranularity } from './coinbase.ts';

/**
 * The one place that decides where a candle series comes from.
 *
 *   crypto     -> Kraken first, Coinbase Exchange as fallback (both keyless)
 *   everything -> Twelve Data
 *
 * Every upstream call goes through the same cache + serial queue, so free-tier
 * limits are respected no matter which path is taken.
 */

const CACHE_TTL_MS = 60_000;
const CANDLE_COUNT = 500;
/** Below this, a series cannot support even a loose pivot scan. */
const MIN_USABLE_CANDLES = 30;

export type CandleSource = 'twelve-data' | 'kraken' | 'coinbase';

interface CachedSeries {
  candles: Candle[];
  source: CandleSource;
}

export interface CandleResponse extends CachedSeries {
  /** True when this answer came from the 60s cache rather than upstream. */
  cached: boolean;
}

const candleCache = new TtlCache<CachedSeries>(CACHE_TTL_MS, 300);
const queue = new SerialQueue();

async function loadKraken(symbol: SymbolConfig, frame: Timeframe | 'W1'): Promise<Candle[]> {
  const config = configFor(frame);
  const pair = symbol.providerSymbol ?? symbol.symbol;
  // Kraken lists weekly (10080) and 4h (240) natively, so no aggregation here.
  return fetchKrakenCandles(pair, config.kraken);
}

async function loadCoinbase(symbol: SymbolConfig, frame: Timeframe | 'W1'): Promise<Candle[]> {
  const config = configFor(frame);
  const product = `${symbol.providerSymbol ?? symbol.symbol}-USD`;

  // Weekly and 4h are not offered by Coinbase; build them from smaller candles.
  if (frame === 'W1') {
    const daily = await fetchCoinbaseCandles(product, 86400, CANDLE_COUNT * 7);
    return aggregateCandles(daily, 604800).slice(-CANDLE_COUNT);
  }
  if (frame === 'H4') {
    const hourly = await fetchCoinbaseCandles(product, 3600, CANDLE_COUNT * 4);
    return aggregateCandles(hourly, 14400).slice(-CANDLE_COUNT);
  }

  const wanted = Math.min(1000, CANDLE_COUNT);
  return fetchCoinbaseCandles(product, coinbaseGranularity(config.minutes * 60), wanted);
}

/**
 * Fetch candles for one symbol + frame, cached for 60 seconds.
 * `frame` accepts the extra 'W1' value used only for D1 confluence.
 */
export async function getCandles(
  symbol: SymbolConfig,
  frame: Timeframe | 'W1',
  twelveDataKey: string | undefined,
): Promise<CandleResponse> {
  const cacheKey = `candles:${symbol.symbol}:${frame}`;

  const { value, cached } = await cachedFetch<CachedSeries>(candleCache, cacheKey, async () => {
    if (symbol.dataSource === 'crypto') {
      try {
        const candles = await queue.run(() => loadKraken(symbol, frame));
        if (candles.length >= MIN_USABLE_CANDLES) return { candles, source: 'kraken' as const };
      } catch (error) {
        // A hard rate limit is worth surfacing; everything else falls through
        // to the Coinbase fallback, which is the whole point of having one.
        if (error instanceof DataError && error.code === 'RATE_LIMIT') throw error;
      }

      const candles = await queue.run(() => loadCoinbase(symbol, frame));
      if (candles.length === 0) {
        throw errors.noData(symbol.symbol, 'Neither Kraken nor Coinbase returned candles.');
      }
      return { candles, source: 'coinbase' as const };
    }

    const candles = await queue.run(() =>
      fetchTwelveDataCandles(symbol, configFor(frame), twelveDataKey),
    );
    return { candles, source: 'twelve-data' as const };
  });

  return { ...value, cached };
}

/**
 * Higher-timeframe candles for the confluence score.
 *
 * Never throws: confluence is a bonus, so a failure here must not break the
 * whole search. The caller gets null and the UI simply shows no badge.
 */
export async function getHigherTimeframeCandles(
  symbol: SymbolConfig,
  higher: ConfluenceTimeframe | null,
  twelveDataKey: string | undefined,
): Promise<{ candles: Candle[]; timeframe: ConfluenceTimeframe } | null> {
  if (!higher) return null;
  try {
    const response = await getCandles(symbol, higher, twelveDataKey);
    if (response.candles.length < 40) return null; // too short to find pivots
    return { candles: response.candles, timeframe: higher };
  } catch {
    return null;
  }
}

/** Exposed so tests (and the API's cache headers) can reason about the cache. */
export function clearCandleCache(): void {
  candleCache.clear();
}
