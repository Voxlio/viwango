/**
 * Shared domain types. Kept free of imports from the network layer so the
 * algorithm module stays pure and testable.
 */

import type { ConfluenceTimeframe, Timeframe } from '../timeframes.ts';

export interface Candle {
  /** Unix seconds, start of the candle. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ZoneKind = 'floor' | 'ceiling';

/** A price band where the market repeatedly turned, plus its strength data. */
export interface Zone {
  kind: ZoneKind;
  /** Bottom of the band (already padded by 0.1 x ATR). */
  low: number;
  /** Top of the band (already padded by 0.1 x ATR). */
  high: number;
  /** How many swing points were merged into this band. */
  touches: number;
  /** Unix seconds of the most recent swing point in the band. */
  lastTouch: number;
  /** Composite 0-100 score: touches + recency + confluence. */
  strength: number;
  /** True when a zone of the same kind overlaps on the higher timeframe. */
  confirmedHigherTf: boolean;
  /** The individual swing prices that formed the band, for debugging/UI. */
  memberPrices: number[];
}

export type MarketState = 'RANGE' | 'UPTREND' | 'DOWNTREND';

export type PriceLocation = 'near_floor' | 'middle' | 'near_ceiling';

export interface MarketAnalysis {
  state: MarketState;
  location: PriceLocation;
  /** 0 = bottom of the recent range, 1 = top. */
  rangePosition: number;
  rangeHigh: number;
  rangeLow: number;
  /** Short reason for the classification, useful for tooltips/debugging. */
  reason: string;
}

export interface LevelsResult {
  symbol: string;
  timeframe: Timeframe;
  /** Current market price — the last candle close. */
  price: number;
  atr: number;
  nearestFloor: Zone | null;
  nearestCeiling: Zone | null;
  /** Up to 3 floors below price, closest first. */
  floors: Zone[];
  /** Up to 3 ceilings above price, closest first. */
  ceilings: Zone[];
  market: MarketAnalysis;
  meta: {
    /** How many candles the analysis ran on. */
    candles: number;
    /** Unix seconds of the newest candle. */
    lastCandleTime: number;
    confluenceChecked: boolean;
    /** Higher timeframe used for confluence, when checked. */
    higherTimeframe: ConfluenceTimeframe | null;
    /** True when an upstream cache served this request. */
    cached?: boolean;
  };
}

export interface AnalyzeOptions {
  pivotLookback?: number;
  /** Cluster tolerance as a multiple of ATR. Default 0.5. */
  clusterAtrMultiple?: number;
  /** Extra padding applied to each side of a zone, in ATRs. Default 0.1. */
  padAtrMultiple?: number;
  /** Minimum swing points for a zone to count. Default 2. */
  minTouches?: number;
  /** Higher-timeframe zones for the confluence score, when enabled. */
  higherTimeframeZones?: Zone[] | null;
  /** Bars used for the recent range / market state. Default 100. */
  rangeLookback?: number;
}
