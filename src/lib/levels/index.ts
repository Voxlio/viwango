import type { Candle, AnalyzeOptions, LevelsResult, Zone } from './types.ts';
import { TIMEFRAMES, type Timeframe } from '../timeframes.ts';
import { latestAtr } from './atr.ts';
import { findPivots } from './pivots.ts';
import { buildZones } from './zones.ts';
import { scoreZones } from './scoring.ts';
import { analyzeMarket } from './market.ts';

export const DEFAULTS = {
  pivotLookback: 5,
  clusterAtrMultiple: 0.5,
  padAtrMultiple: 0.1,
  minTouches: 2,
  rangeLookback: 100,
} as const;

/** How many zones of each side the API exposes. */
export const MAX_ZONES_PER_SIDE = 3;

/**
 * A zone "contains" price when price is inside the band, or within a tenth of
 * an ATR of it. A band you are currently sitting inside is genuinely the level
 * price is testing — it would be odd to skip it and report something further
 * away instead.
 */
function containsPrice(zone: Zone, price: number, atrValue: number): boolean {
  const slack = atrValue * 0.1;
  return price >= zone.low - slack && price <= zone.high + slack;
}

/**
 * Main entry point. Pure function: same candles in, same result out. All the
 * network work happens in the caller, which makes every step here unit-testable
 * with a hand-made candle array.
 */
export function analyzeLevels(
  candles: Candle[],
  symbol: string,
  timeframe: Timeframe,
  timeframeMinutes: number,
  options: AnalyzeOptions = {},
): LevelsResult {
  const pivotLookback = options.pivotLookback ?? DEFAULTS.pivotLookback;
  const clusterAtrMultiple = options.clusterAtrMultiple ?? DEFAULTS.clusterAtrMultiple;
  const padAtrMultiple = options.padAtrMultiple ?? DEFAULTS.padAtrMultiple;
  const minTouches = options.minTouches ?? DEFAULTS.minTouches;
  const rangeLookback = options.rangeLookback ?? DEFAULTS.rangeLookback;
  const higherZones = options.higherTimeframeZones ?? null;

  if (candles.length < pivotLookback * 2 + 2) {
    throw new Error(
      `Not enough candles to analyse (${candles.length}). Need at least ${pivotLookback * 2 + 2}.`,
    );
  }

  const atrValue = latestAtr(candles, 14);
  if (atrValue === null || !Number.isFinite(atrValue) || atrValue <= 0) {
    throw new Error('Could not compute ATR from the candles provided.');
  }

  const pivots = findPivots(candles, { lookback: pivotLookback });
  const tolerance = atrValue * clusterAtrMultiple;
  const padding = atrValue * padAtrMultiple;

  const floorsRaw = buildZones(pivots.lows, 'floor', candles, atrValue, tolerance, padding, minTouches);
  const ceilingsRaw = buildZones(pivots.highs, 'ceiling', candles, atrValue, tolerance, padding, minTouches);

  const price = candles[candles.length - 1].close;
  const scoreContext = { now: candles[candles.length - 1].time, timeframeMinutes, higherZones };

  const floors = scoreZones(floorsRaw, scoreContext);
  const ceilings = scoreZones(ceilingsRaw, scoreContext);

  // Nearest floor: the highest floor band at or below price. If price is inside
  // a band, that band counts as the active floor. Stronger zone wins a tie.
  const floorsBelow = floors
    .filter((zone) => zone.high <= price && !containsPrice(zone, price, atrValue))
    .sort((a, b) => b.high - a.high || b.strength - a.strength);
  const floorsContaining = floors
    .filter((zone) => containsPrice(zone, price, atrValue))
    .sort((a, b) => b.strength - a.strength);

  const ceilingsAbove = ceilings
    .filter((zone) => zone.low >= price && !containsPrice(zone, price, atrValue))
    .sort((a, b) => a.low - b.low || b.strength - a.strength);
  const ceilingsContaining = ceilings
    .filter((zone) => containsPrice(zone, price, atrValue))
    .sort((a, b) => b.strength - a.strength);

  const nearestFloor = floorsContaining[0] ?? floorsBelow[0] ?? null;
  const nearestCeiling = ceilingsContaining[0] ?? ceilingsAbove[0] ?? null;

  // The list keeps only genuinely above/below bands, closest first.
  const floorList = floorsBelow.slice(0, MAX_ZONES_PER_SIDE);
  const ceilingList = ceilingsAbove.slice(0, MAX_ZONES_PER_SIDE);

  const market = analyzeMarket(candles, pivots, atrValue, rangeLookback);
  const lastCandle = candles[candles.length - 1];

  return {
    symbol,
    timeframe,
    price,
    atr: atrValue,
    nearestFloor,
    nearestCeiling,
    floors: floorList,
    ceilings: ceilingList,
    market,
    meta: {
      candles: candles.length,
      lastCandleTime: lastCandle.time,
      confluenceChecked: higherZones !== null,
      higherTimeframe: higherZones !== null ? higherTimeframeLabel(timeframe) : null,
    },
  };
}

export function higherTimeframeLabel(timeframe: Timeframe): Timeframe | 'W1' | null {
  // Single source of truth lives in the timeframe config table.
  return TIMEFRAMES[timeframe].higher;
}

export type { Candle, Zone, LevelsResult } from './types.ts';
export { atr, latestAtr } from './atr.ts';
export { findPivots } from './pivots.ts';
export { clusterPivots, buildZones, isZoneBroken, zonesOverlap } from './zones.ts';
export { scoreZone, scoreZones, touchScore, recencyScore } from './scoring.ts';
export { analyzeMarket, classifyLocation } from './market.ts';
