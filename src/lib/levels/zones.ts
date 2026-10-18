import type { Candle, Zone, ZoneKind } from './types.ts';
import type { Pivot } from './pivots.ts';

/**
 * Clustering: turn a pile of individual swing prices into price *zones*.
 *
 * Swing points never land on the exact same price, so "support at 2318" is
 * really a band. We sort swing lows ascending and start a new cluster whenever
 * the next price is further than `tolerance` from the running cluster's mean.
 * Using the mean (rather than the last price) stops a slow drift of many
 * pivots from being swallowed into one giant zone.
 */

export interface ClusterOptions {
  /** Maximum distance between a point and the cluster mean. Usually 0.5 x ATR. */
  tolerance: number;
  /** Padding added to each side of the finished band. Usually 0.1 x ATR. */
  padding: number;
}

export interface RawCluster {
  prices: number[];
  times: number[];
}

export function clusterPivots(pivots: Pivot[], tolerance: number): RawCluster[] {
  if (pivots.length === 0) return [];
  const sorted = [...pivots].sort((a, b) => a.price - b.price);

  const clusters: RawCluster[] = [];
  let current: RawCluster = { prices: [], times: [] };
  let sum = 0;

  for (const pivot of sorted) {
    if (current.prices.length === 0) {
      current = { prices: [pivot.price], times: [pivot.time] };
      sum = pivot.price;
      continue;
    }
    const mean = sum / current.prices.length;
    if (Math.abs(pivot.price - mean) <= tolerance) {
      current.prices.push(pivot.price);
      current.times.push(pivot.time);
      sum += pivot.price;
    } else {
      clusters.push(current);
      current = { prices: [pivot.price], times: [pivot.time] };
      sum = pivot.price;
    }
  }
  clusters.push(current);

  return clusters;
}

/**
 * Turn raw clusters into padded bands. The band spans the lowest and highest
 * member price, then grows by `padding` on both sides so it represents the
 * whole rejection area rather than the exact peak of a wick.
 */
export function clusterToBand(
  cluster: RawCluster,
  padding: number,
): { low: number; high: number; touches: number; lastTouch: number } {
  const min = Math.min(...cluster.prices);
  const max = Math.max(...cluster.prices);
  return {
    low: min - padding,
    high: max + padding,
    touches: cluster.prices.length,
    lastTouch: Math.max(...cluster.times),
  };
}

/**
 * Broken-zone filter.
 *
 * A zone stops being useful once price has decisively closed beyond it more
 * than once — that is a breakout, not a bounce. We count *episodes* rather than
 * bars so that a single slow push through a zone (many candles closing on the
 * far side) still counts as one break. Anything inside `tolerance` of the band
 * edge counts as "at the zone", not through it.
 *
 * Returns true when the zone should be discarded.
 */
export function isZoneBroken(
  zone: { kind: ZoneKind; low: number; high: number },
  candles: Candle[],
  tolerance: number,
): boolean {
  let breaks = 0;
  let insideEpisode = false;

  for (const candle of candles) {
    const beyond =
      zone.kind === 'ceiling'
        ? candle.close > zone.high + tolerance
        : candle.close < zone.low - tolerance;

    if (beyond && !insideEpisode) {
      breaks += 1;
      insideEpisode = true;
    } else if (!beyond) {
      insideEpisode = false;
    }

    if (breaks > 1) return true;
  }

  return false;
}

/**
 * Build zones for one side of the market.
 *
 * `minTouches` filters out bands formed by a single wick — one touch is noise,
 * two is a hint, three or more is a level worth watching.
 */
export function buildZones(
  pivots: Pivot[],
  kind: ZoneKind,
  candles: Candle[],
  atrValue: number,
  clusterTolerance: number,
  padding: number,
  minTouches: number,
): Zone[] {
  const clusters = clusterPivots(pivots, clusterTolerance);
  const zones: Zone[] = [];

  for (const cluster of clusters) {
    if (cluster.prices.length < minTouches) continue;
    const band = clusterToBand(cluster, padding);
    if (isZoneBroken({ kind, ...band }, candles, clusterTolerance)) continue;

    zones.push({
      kind,
      low: band.low,
      high: band.high,
      touches: band.touches,
      lastTouch: band.lastTouch,
      strength: 0, // filled in by scoring.ts once confluence is known
      confirmedHigherTf: false,
      memberPrices: [...cluster.prices].sort((a, b) => a - b),
    });
  }

  // Guard against a zone whose padding has grown larger than the data allows.
  return zones.filter((zone) => Number.isFinite(zone.low) && zone.low < zone.high && atrValue > 0);
}

/** Two bands overlap when they share any price. */
export function zonesOverlap(
  a: { low: number; high: number },
  b: { low: number; high: number },
): boolean {
  return a.low <= b.high && b.low <= a.high;
}
