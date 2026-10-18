import type { Timeframe } from '../timeframes.ts';
import type { Zone } from './types.ts';
import { zonesOverlap } from './zones.ts';

/**
 * Zone strength, 0-100.
 *
 * Three ingredients, weighted so that "how many times did price turn here"
 * dominates, "how recently" is a meaningful modifier, and "was it also visible
 * one timeframe up" is a bonus rather than the whole story:
 *
 *   touches    0-55   (2 touches = 28, each extra adds 9, caps at 6 touches)
 *   recency    0-30   (halves every 100 bars since the last touch)
 *   confluence 0-15   (flat bonus when a same-kind higher-TF zone overlaps)
 *
 * The touch curve starts at 28 rather than 0 because a zone only reaches
 * scoring with at least `minTouches` swings — the minimum case should read as
 * "worth watching", not "worthless".
 */

export const SCORE_WEIGHTS = {
  touches: 55,
  recency: 30,
  confluence: 15,
} as const;

/** Bars after which the recency contribution halves. */
export const RECENCY_HALF_LIFE_BARS = 100;

export function touchScore(touches: number): number {
  const clamped = Math.max(1, Math.floor(touches));
  const scaled = Math.min(SCORE_WEIGHTS.touches, 28 + (clamped - 2) * 9);
  return Math.max(0, scaled);
}

export function recencyScore(lastTouch: number, now: number, timeframeMinutes: number): number {
  const barSeconds = Math.max(1, timeframeMinutes * 60);
  // Nothing can be touched in the future; clamp negative age to zero.
  const barsSince = Math.max(0, (now - lastTouch) / barSeconds);
  const decay = Math.pow(0.5, barsSince / RECENCY_HALF_LIFE_BARS);
  return SCORE_WEIGHTS.recency * decay;
}

export function confluenceScore(
  zone: Zone,
  higherZones: Zone[] | null | undefined,
): { points: number; confirmed: boolean } {
  if (!higherZones || higherZones.length === 0) return { points: 0, confirmed: false };
  const overlap = higherZones.some(
    (higher) => higher.kind === zone.kind && zonesOverlap(zone, higher),
  );
  return { points: overlap ? SCORE_WEIGHTS.confluence : 0, confirmed: overlap };
}

export interface ScoreContext {
  /** Unix seconds of the newest candle. */
  now: number;
  timeframeMinutes: number;
  higherZones?: Zone[] | null;
}

/**
 * Returns the zone with `strength` and `confirmedHigherTf` filled in.
 * Pure: the input object is not mutated.
 */
export function scoreZone(zone: Zone, context: ScoreContext): Zone {
  const confluence = confluenceScore(zone, context.higherZones);
  const total =
    touchScore(zone.touches) +
    recencyScore(zone.lastTouch, context.now, context.timeframeMinutes) +
    confluence.points;

  return {
    ...zone,
    strength: Math.max(0, Math.min(100, Math.round(total))),
    confirmedHigherTf: confluence.confirmed,
  };
}

export function scoreZones(zones: Zone[], context: ScoreContext): Zone[] {
  return zones.map((zone) => scoreZone(zone, context));
}

/** Used by the API to label which timeframe supplied confluence. */
export function higherTimeframeOf(tf: Timeframe): Timeframe | null {
  return tf === 'M15' ? 'H1' : tf === 'H1' ? 'H4' : tf === 'H4' ? 'D1' : null;
}
