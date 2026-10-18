import type { Candle } from './types.ts';

/**
 * Wilder's Average True Range.
 *
 * True range is the largest of:
 *   - today's high minus today's low
 *   - |today's high - yesterday's close|
 *   - |today's low  - yesterday's close|
 *
 * The second and third terms capture overnight gaps, which is why ATR is wider
 * than a plain high-low average.
 *
 * Returns an array the same length as the input. Entries before the first full
 * period are `null` because ATR is undefined there.
 */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previousClose = candles[i - 1].close;
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previousClose),
        Math.abs(current.low - previousClose),
      ),
    );
  }

  // First ATR is the simple average of the first `period` true ranges.
  // trueRanges[0] belongs to candle index 1, so the seed lands on index `period`.
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trueRanges[i];
  let currentAtr = sum / period;
  out[period] = currentAtr;

  // Wilder smoothing from there on.
  for (let i = period; i < trueRanges.length; i++) {
    currentAtr = (currentAtr * (period - 1) + trueRanges[i]) / period;
    out[i + 1] = currentAtr;
  }

  return out;
}

/**
 * Convenience: the latest ATR value, or null when there are not enough candles.
 * Falls back to scanning backwards so a run of nulls at the tail (which cannot
 * happen with this implementation) would never produce a silent zero.
 */
export function latestAtr(candles: Candle[], period = 14): number | null {
  const series = atr(candles, period);
  for (let i = series.length - 1; i >= 0; i--) {
    const value = series[i];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}
