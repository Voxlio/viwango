/**
 * Timeframes the app supports. Each one knows how to ask every data source for
 * its candles, and which higher timeframe is used for confluence checks.
 *
 * Confluence asks "was a zone also found one step up?" — M15 -> H1 -> H4 -> D1.
 * D1 looks at W1, which requires a weekly fetch; that is the one case where the
 * extra call can return few candles, so it is optional and handled gracefully.
 */

export type Timeframe = 'M15' | 'H1' | 'H4' | 'D1';

/**
 * Timeframes that can supply confluence. 'W1' is not user-selectable, it only
 * exists as the "one step above D1" frame.
 */
export type ConfluenceTimeframe = Timeframe | 'W1';

export interface TimeframeConfig {
  id: Timeframe | 'W1';
  label: string;
  /** Minutes per candle — handy for recency maths and chart bucketing. */
  minutes: number;
  /** Twelve Data `interval` value. */
  twelveData: string;
  /** Kraken `interval` value (minutes). */
  kraken: number;
  /** Coinbase granularity in seconds, used when aggregating. */
  coinbaseSeconds: number;
  /** Timeframe used for the confluence check. null = no higher frame. */
  higher: ConfluenceTimeframe | null;
}

export const TIMEFRAMES: Record<Timeframe, TimeframeConfig> = {
  M15: {
    id: 'M15',
    label: '15m',
    minutes: 15,
    twelveData: '15min',
    kraken: 15,
    coinbaseSeconds: 900,
    higher: 'H1',
  },
  H1: {
    id: 'H1',
    label: '1h',
    minutes: 60,
    twelveData: '1h',
    kraken: 60,
    coinbaseSeconds: 3600,
    higher: 'H4',
  },
  H4: {
    id: 'H4',
    label: '4h',
    minutes: 240,
    twelveData: '4h',
    kraken: 240,
    coinbaseSeconds: 3600, // Coinbase has no 4h; 1h is fetched and bucketed.
    higher: 'D1',
  },
  D1: {
    id: 'D1',
    label: '1D',
    minutes: 1440,
    twelveData: '1day',
    kraken: 1440,
    coinbaseSeconds: 86400,
    higher: 'W1',
  },
};

/** Extra weekly timeframe, used only for D1 confluence. Not user-selectable. */
export const WEEKLY: TimeframeConfig = {
  id: 'W1',
  label: '1W',
  minutes: 10080,
  twelveData: '1week',
  kraken: 10080,
  coinbaseSeconds: 86400, // aggregated to 7 days locally
  higher: null,
};

/** Every frame the data layer can fetch, including the confluence-only W1. */
export function configFor(frame: Timeframe | 'W1'): TimeframeConfig {
  return frame === 'W1' ? WEEKLY : TIMEFRAMES[frame];
}

export const TIMEFRAME_ORDER: readonly Timeframe[] = ['M15', 'H1', 'H4', 'D1'];

export function isTimeframe(value: string): value is Timeframe {
  return Object.prototype.hasOwnProperty.call(TIMEFRAMES, value);
}

/** How many candles to pull per request. Twelve Data free tier allows 5000/req. */
export const CANDLE_COUNT = 500;
