import type { Candle } from './types.ts';

/**
 * A swing point (a.k.a. pivot / fractal). A swing high is a candle whose high
 * is the highest of the `lookback` candles on each side of it; a swing low is
 * the mirror image using lows.
 *
 * We deliberately use wicks (the high / low of the candle) rather than closes.
 * A wick that pokes above a cluster and gets rejected is exactly the evidence
 * that a ceiling exists there — ignoring it would throw away the best signal.
 *
 * The newest `lookback` candles are excluded: a swing needs `lookback` candles
 * to its right to be confirmed, so the very last bars cannot qualify yet.
 */

export interface Pivot {
  /** Index into the candle array. */
  index: number;
  /** The extreme price (high for swing highs, low for swing lows). */
  price: number;
  /** Unix seconds of the candle. */
  time: number;
}

export interface PivotOptions {
  /** Candles required on each side. Default 5 (matches the app default). */
  lookback?: number;
}

export interface PivotSet {
  highs: Pivot[];
  lows: Pivot[];
}

export function findPivots(candles: Candle[], options: PivotOptions = {}): PivotSet {
  const lookback = Math.max(1, Math.floor(options.lookback ?? 5));
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];

  // A pivot at index i needs `lookback` bars on both sides.
  for (let i = lookback; i < candles.length - lookback; i++) {
    const candle = candles[i];

    let isHigh = true;
    let isLow = true;

    for (let offset = 1; offset <= lookback; offset++) {
      const left = candles[i - offset];
      const right = candles[i + offset];

      // `>=` on the left, `>` on the right: flat tops collapse to the first
      // bar of the plateau instead of producing several identical pivots.
      if (left.high > candle.high) isHigh = false;
      if (right.high >= candle.high) isHigh = false;
      if (left.low < candle.low) isLow = false;
      if (right.low <= candle.low) isLow = false;

      if (!isHigh && !isLow) break;
    }

    if (isHigh) highs.push({ index: i, price: candle.high, time: candle.time });
    if (isLow) lows.push({ index: i, price: candle.low, time: candle.time });
  }

  return { highs, lows };
}
