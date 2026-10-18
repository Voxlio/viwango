/**
 * Error type shared by every data source, so the API route can map failures to
 * friendly messages without inspecting provider-specific shapes.
 */

export type DataErrorCode =
  | 'CONFIG' // missing API key
  | 'RATE_LIMIT' // upstream said "slow down"
  | 'NO_DATA' // upstream answered but had nothing for this symbol
  | 'UPSTREAM' // anything else (network, 5xx, unexpected payload)
  | 'INVALID_SYMBOL'; // symbol is not covered by the chosen source

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly status: number;
  /** Short, user-facing sentence. Never contains keys or internals. */
  readonly userMessage: string;

  constructor(code: DataErrorCode, userMessage: string, status = 502, cause?: unknown) {
    super(userMessage);
    this.name = 'DataError';
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
    if (cause !== undefined) this.cause = cause;
  }
}

export const errors = {
  missingKey: () =>
    new DataError(
      'CONFIG',
      'This symbol needs a Twelve Data API key. Add TWELVE_DATA_KEY to your environment and restart the app.',
      503,
    ),
  rateLimited: () =>
    new DataError(
      'RATE_LIMIT',
      'The free data provider limit was reached. Wait about a minute, then try again.',
      429,
    ),
  noData: (symbol: string, extra = '') =>
    new DataError(
      'NO_DATA',
      `No recent candles were returned for ${symbol}.${extra ? ` ${extra}` : ''}`,
      404,
    ),
  upstream: (detail = 'The data provider did not answer as expected.') =>
    new DataError('UPSTREAM', detail, 502),
  invalidSymbol: (symbol: string, source: string) =>
    new DataError('INVALID_SYMBOL', `${symbol} is not available from ${source}.`, 400),
};

/**
 * fetch with a hard timeout. Vercel functions have their own limits, but a
 * hanging upstream should not consume the whole budget: 10s is plenty for a
 * 500-candle JSON payload.
 */
export async function fetchJson(
  url: string,
  timeoutMs = 10_000,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', ...headers },
      // Never let Next attempt to cache this at the framework level: the app
      // has its own 60s TTL and needs to see upstream errors.
      cache: 'no-store',
    });

    if (response.status === 429) throw errors.rateLimited();
    if (response.status === 401 || response.status === 403) {
      throw new DataError(
        'CONFIG',
        'The data provider rejected the API key. Check TWELVE_DATA_KEY.',
        502,
      );
    }
    if (response.status === 404) throw errors.noData('that symbol');
    if (!response.ok) {
      throw errors.upstream(`The data provider returned HTTP ${response.status}.`);
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof DataError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw errors.upstream('The data provider took too long to respond. Try again.');
    }
    throw errors.upstream('Could not reach the data provider. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

/** Narrow an unknown JSON value to an object without `any`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
