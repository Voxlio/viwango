import type { Candle } from './types.ts';
import type { Pivot } from './pivots.ts';

/**
 * Hand-built candle series used by the unit tests. Every fixture has a known
 * answer by construction, so a failure points at the algorithm rather than at
 * a mysterious market.
 */

export function candle(time: number, high: number, low: number, close = (high + low) / 2): Candle {
  return { time, open: close, high, low, close };
}

/** Sixteen candles whose true range is exactly 2 on every bar. */
export function constantRangeCandles(): Candle[] {
  return Array.from({ length: 16 }, (_, i) => candle(1_600_000_000 + i * 3600, 100 + i * 0.5, 98 + i * 0.5));
}

/**
 * Same shape as above but with one big gap at index 1 (low 100 -> high 120).
 * The gap only shows up in true range via |high - previous close|.
 */
export function gappedCandles(): Candle[] {
  const out: Candle[] = [{ time: 0, open: 100, high: 102, low: 100, close: 100 }];
  for (let i = 1; i < 16; i++) {
    out.push(candle(i * 3600, 122 + i, 120 + i));
  }
  return out;
}

/**
 * 13 candles with exactly two confirmed pivots when lookback = 2:
 *   swing low  at index 2 (low  1)
 *   swing high at index 6 (high 13)
 */
export function simplePivotCandles(): Candle[] {
  const highs = [9, 10, 11, 10, 11, 12, 13, 12, 11, 10, 9, 8, 7];
  const lows = [7, 8, 1, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
  return lows.map((low, i) => candle(i * 3600, highs[i], low));
}

/** Flat tops: the plateau at price 110 must produce a single pivot, not three. */
export function flatTopCandles(): Candle[] {
  const highs = [100, 102, 105, 110, 110, 110, 105, 101, 98];
  const lows = highs.map((h) => h - 3);
  return lows.map((low, i) => candle(i * 3600, highs[i], low));
}

/** Pivots below are the ones a weak low in a bullish candle must not produce. */
export function pivotsAt(prices: number[]): Pivot[] {
  return prices.map((price, i) => ({ index: i, price, time: 1_700_000_000 + i * 3600 }));
}

/**
 * Twenty alternating candles between 100 and 110. Used to show that a ceiling
 * formed at 110 can be cleared (two closes above it) and therefore dropped.
 */
export function clearableCeilingCandles(): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 10; i++) {
    out.push(candle(i * 3600, 110, 100, i % 2 === 0 ? 105 : 104));
  }
  for (let i = 0; i < 10; i++) {
    out.push(candle((10 + i) * 3600, 110, 100, 105));
  }
  return out;
}

/**
 * A clean uptrend built from stairs, with a known structure:
 *   ... low 116 -> high 130 -> low 125 -> high 134 ...
 * Swing highs rise and swing lows rise, so the state must be UPTREND.
 */
export function uptrendCandles(): Candle[] {
  const out: Candle[] = [];
  let t = 0;
  const push = (high: number, low: number, close: number) => {
    out.push(candle(t++ * 3600, high, low, close));
  };

  // Leg 1: 100 -> 120 in small steps.
  for (let i = 0; i <= 20; i++) push(100 + i, 99 + i, 100 + i);
  // Pullback to 110 with one bar clearly lower than anything around it.
  push(118, 114, 115);
  push(116, 110, 112);
  push(119, 111, 118);
  // Leg 2: 118 -> 130.
  for (let i = 0; i <= 10; i++) push(118 + i, 117 + i, 118 + i);
  // Pullback to 125.
  push(129, 126, 127);
  push(127, 125, 126);
  push(130, 126, 129);
  // Final leg.
  for (let i = 0; i <= 4; i++) push(130 + i, 129 + i, 130 + i);

  return out;
}

/** Exact mirror of `uptrendCandles` around 118.5 — must classify DOWNTREND. */
export function downtrendCandles(): Candle[] {
  return uptrendCandles().map((c) =>
    candle(c.time, 237 - c.low, 237 - c.high, 237 - c.close),
  );
}

/**
 * A sideways market: ceiling repeatedly at 110, floor repeatedly at 100.
 * Swing highs are 106 and 110 (rising) while swing lows are 100 and 100
 * (flat), so structure is mixed and the state must be RANGE.
 */
export function rangeCandles(): Candle[] {
  const out: Candle[] = [];
  let t = 0;
  const push = (high: number, low: number, close: number) => {
    out.push(candle(t++ * 3600, high, low, close));
  };

  for (let cycle = 0; cycle < 4; cycle++) {
    // Rise into the ceiling.
    for (let i = 0; i < 5; i++) push(100 + i * 2, 101 + i * 2, 100 + i * 2);
    push(110, 106, 108); // the ceiling touch
    // Fall into the floor.
    for (let i = 0; i < 5; i++) push(108 - i * 2, 100 - 0 + (4 - i) * 2, 108 - i * 2);
    push(102, 100, 101); // the floor touch
  }
  return out;
}

/**
 * A clean floor and ceiling with five touches each, ending mid-range at 105.
 * Floor band ~99-101, ceiling band ~109-111.
 */
export function floorAndCeilingCandles(): Candle[] {
  const out: Candle[] = [];
  let t = 0;
  const push = (high: number, low: number, close: number) => {
    out.push(candle(t++ * 3600, high, low, close));
  };

  for (let cycle = 0; cycle < 5; cycle++) {
    push(101, 100, 100.5);
    push(103, 102, 103);
    push(106, 104, 106);
    push(108, 105, 107);
    push(110, 109, 109.5);
    push(109, 107, 108);
    push(106, 104, 105);
    push(103, 102, 102);
    push(100.5, 100, 100.5);
  }
  // End in the middle of the range.
  push(107, 103, 105);
  return out;
}
