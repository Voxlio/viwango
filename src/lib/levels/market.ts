import type { Candle, MarketAnalysis, MarketState, PriceLocation } from './types.ts';
import type { PivotSet } from './pivots.ts';

/**
 * Market state from swing structure + the recent price range.
 *
 * "Structure" is the pattern of swing highs and lows:
 *   higher highs AND higher lows -> UPTREND
 *   lower highs  AND lower lows  -> DOWNTREND
 *   anything mixed               -> RANGE
 *
 * With fewer than two confirmed swings on either side there is no structure to
 * read, so we fall back on a simple test: did price travel more than a normal
 * candle range (ATR) over the window, and if so in which direction?
 *
 * `location` then answers the practical question — is price at one end of the
 * recent range or stuck in the middle? 25% / 75% are used as the edges; inside
 * that band there is no edge to trade against.
 */

export const RANGE_LOOKBACK = 100;
export const NEAR_EDGE_THRESHOLD = 0.25;

export function classifyLocation(rangePosition: number): PriceLocation {
  if (rangePosition <= NEAR_EDGE_THRESHOLD) return 'near_floor';
  if (rangePosition >= 1 - NEAR_EDGE_THRESHOLD) return 'near_ceiling';
  return 'middle';
}

export function analyzeMarket(
  candles: Candle[],
  pivots: PivotSet,
  atrValue: number,
  lookback = RANGE_LOOKBACK,
): MarketAnalysis {
  const window = candles.slice(-Math.max(10, lookback));
  const first = window[0];
  const last = window[window.length - 1];

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (const candle of window) {
    if (candle.high > rangeHigh) rangeHigh = candle.high;
    if (candle.low < rangeLow) rangeLow = candle.low;
  }

  const span = rangeHigh - rangeLow;
  const rangePosition = span > 0 ? (last.close - rangeLow) / span : 0.5;

  const highs = pivots.highs.slice(-3);
  const lows = pivots.lows.slice(-3);

  let state: MarketState;
  let reason: string;

  if (highs.length >= 2 && lows.length >= 2) {
    const [prevHigh, lastHigh] = highs.slice(-2);
    const [prevLow, lastLow] = lows.slice(-2);

    const higherHighs = lastHigh.price > prevHigh.price;
    const higherLows = lastLow.price > prevLow.price;
    const lowerHighs = lastHigh.price < prevHigh.price;
    const lowerLows = lastLow.price < prevLow.price;

    if (higherHighs && higherLows) {
      state = 'UPTREND';
      reason = 'Swing highs and swing lows are both rising (higher highs and higher lows).';
    } else if (lowerHighs && lowerLows) {
      state = 'DOWNTREND';
      reason = 'Swing highs and swing lows are both falling (lower highs and lower lows).';
    } else {
      state = 'RANGE';
      reason = 'Swing points are mixed: highs and lows are not moving the same way.';
    }
  } else {
    // Not enough structure — fall back to net travel measured in ATRs.
    const travel = last.close - first.close;
    const threshold = atrValue * 0.5;
    if (travel > threshold && atrValue > 0) {
      state = 'UPTREND';
      reason = 'Too few swing points to read structure; price travelled up more than half an ATR.';
    } else if (travel < -threshold && atrValue > 0) {
      state = 'DOWNTREND';
      reason = 'Too few swing points to read structure; price travelled down more than half an ATR.';
    } else {
      state = 'RANGE';
      reason = 'Too few swing points to read structure; price ended near where it started.';
    }
  }

  return {
    state,
    location: classifyLocation(rangePosition),
    rangePosition: Math.max(0, Math.min(1, rangePosition)),
    rangeHigh,
    rangeLow,
    reason,
  };
}
