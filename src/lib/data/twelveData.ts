import type { Candle } from '../levels/types.ts';
import type { SymbolConfig } from '../symbols.ts';
import type { TimeframeConfig } from '../timeframes.ts';
import { CANDLE_COUNT } from '../timeframes.ts';
import { DataError, errors, fetchJson, isRecord, toNumber } from './errors.ts';

/**
 * Twelve Data — gold, silver, forex and stocks.
 *
 * Free tier: 8 credits/minute, 800/day. One `time_series` call costs one
 * credit. The app makes at most two per search and caches for 60s, so ordinary
 * use stays inside the limit.
 *
 * Docs: https://twelvedata.com/docs#time-series
 */

const BASE_URL = 'https://api.twelvedata.com/time_series';

interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

function parseValues(payload: Record<string, unknown>): TwelveDataValue[] {
  const values = payload.values;
  if (!Array.isArray(values)) return [];
  return values.filter(
    (row): row is TwelveDataValue =>
      isRecord(row) &&
      typeof row.datetime === 'string' &&
      typeof row.open === 'string' &&
      typeof row.high === 'string' &&
      typeof row.low === 'string' &&
      typeof row.close === 'string',
  );
}

/**
 * Twelve Data returns "2024-05-01 12:00:00" in the requested timezone. We ask
 * for UTC and parse it as UTC explicitly — `new Date("2024-05-01 12:00:00")`
 * without the T/Z would be interpreted as local time on the server and shift
 * every candle by the function's timezone offset.
 */
export function parseTwelveDataDate(value: string): number {
  const normalised = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`;
  return Math.floor(new Date(withZone).getTime() / 1000);
}

export async function fetchTwelveDataCandles(
  symbol: SymbolConfig,
  timeframe: TimeframeConfig,
  apiKey: string | undefined,
): Promise<Candle[]> {
  if (!apiKey) throw errors.missingKey();

  const params = new URLSearchParams({
    symbol: symbol.providerSymbol ?? symbol.symbol,
    interval: timeframe.twelveData,
    outputsize: String(CANDLE_COUNT),
    timezone: 'UTC',
    order: 'ASC',
    apikey: apiKey,
  });

  const payload = await fetchJson(`${BASE_URL}?${params.toString()}`);
  if (!isRecord(payload)) throw errors.upstream();

  // Twelve Data signals problems in the body with HTTP 200.
  if (payload.status === 'error') {
    const message = typeof payload.message === 'string' ? payload.message.toLowerCase() : '';
    if (message.includes('rate') || message.includes('limit') || message.includes('credit')) {
      throw errors.rateLimited();
    }
    if (message.includes('apikey') || message.includes('api key')) {
      throw new DataError('CONFIG', 'The data provider rejected the API key. Check TWELVE_DATA_KEY.', 502);
    }
    if (message.includes('not found') || message.includes('symbol')) {
      throw errors.noData(symbol.symbol, 'Twelve Data may not cover it on the free plan.');
    }
    throw errors.upstream('The data provider rejected the request for this symbol.');
  }

  const rows = parseValues(payload);
  if (rows.length === 0) throw errors.noData(symbol.symbol);

  const candles: Candle[] = [];
  for (const row of rows) {
    const time = parseTwelveDataDate(row.datetime);
    const open = toNumber(row.open);
    const high = toNumber(row.high);
    const low = toNumber(row.low);
    const close = toNumber(row.close);

    // Skip malformed rows rather than emitting NaN candles downstream.
    if (!Number.isFinite(time) || open === null || high === null || low === null || close === null) {
      continue;
    }
    candles.push({ time, open, high, low, close });
  }

  if (candles.length === 0) throw errors.noData(symbol.symbol);

  // Defensive: the API is asked for ASC order, but sorting costs nothing and
  // the rest of the app assumes oldest-first.
  candles.sort((a, b) => a.time - b.time);
  return candles;
}
