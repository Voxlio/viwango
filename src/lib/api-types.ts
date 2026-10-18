import type { Candle, LevelsResult } from './levels/types.ts';

/**
 * Shape of GET /api/levels. Shared by the route and the page so the two can
 * never drift apart.
 */

export interface SwingPoint {
  time: number;
  price: number;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  kind: 'metal' | 'forex' | 'crypto' | 'stock';
  pricePrecision: number;
}

export interface LevelsMetaWithSource {
  candles: number;
  lastCandleTime: number;
  confluenceChecked: boolean;
  higherTimeframe: string | null;
  cached?: boolean;
  source?: 'twelve-data' | 'kraken' | 'coinbase';
}

export interface LevelsResponse extends Omit<LevelsResult, 'meta'> {
  meta: LevelsMetaWithSource;
  symbolInfo: SymbolInfo;
  candles: Candle[];
  swings: { highs: SwingPoint[]; lows: SwingPoint[] };
  changePercent: number;
  generatedAt: string;
}

export interface LevelsApiError {
  error: {
    code: string;
    message: string;
  };
}

export function isLevelsResponse(value: unknown): value is LevelsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LevelsResponse>;
  return (
    typeof candidate.price === 'number' &&
    Array.isArray(candidate.candles) &&
    typeof candidate.symbol === 'string'
  );
}

export function isLevelsApiError(value: unknown): value is LevelsApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LevelsApiError>;
  return typeof candidate.error === 'object' && candidate.error !== null;
}
