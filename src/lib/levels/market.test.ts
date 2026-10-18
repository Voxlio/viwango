import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeMarket, classifyLocation } from './market.ts';
import { findPivots } from './pivots.ts';
import { latestAtr } from './atr.ts';
import { uptrendCandles, downtrendCandles, rangeCandles, candle } from './fixtures.test-helpers.ts';

function classify(candles: ReturnType<typeof uptrendCandles>) {
  const pivots = findPivots(candles, { lookback: 2 });
  const atrValue = latestAtr(candles) ?? 1;
  return analyzeMarket(candles, pivots, atrValue, 100);
}

test('rising swing highs and lows classify as UPTREND', () => {
  const result = classify(uptrendCandles());
  assert.equal(result.state, 'UPTREND');
});

test('falling swing highs and lows classify as DOWNTREND', () => {
  const result = classify(downtrendCandles());
  assert.equal(result.state, 'DOWNTREND');
});

test('mixed structure classifies as RANGE', () => {
  const result = classify(rangeCandles());
  assert.equal(result.state, 'RANGE');
});

test('range position is normalised between 0 and 1', () => {
  const result = classify(rangeCandles());
  assert.ok(result.rangePosition >= 0 && result.rangePosition <= 1);
  assert.ok(result.rangeHigh > result.rangeLow);
});

test('location thresholds are 25% and 75% of the range', () => {
  assert.equal(classifyLocation(0), 'near_floor');
  assert.equal(classifyLocation(0.25), 'near_floor');
  assert.equal(classifyLocation(0.26), 'middle');
  assert.equal(classifyLocation(0.5), 'middle');
  assert.equal(classifyLocation(0.74), 'middle');
  assert.equal(classifyLocation(0.75), 'near_ceiling');
  assert.equal(classifyLocation(1), 'near_ceiling');
});

test('location follows the current price, not the range midpoint', () => {
  const nearTop = analyzeMarket(
    [
      candle(0, 110, 100, 100),
      candle(1, 110, 100, 105),
      candle(2, 110, 100, 109),
    ],
    { highs: [], lows: [] },
    1,
    100,
  );
  assert.equal(nearTop.location, 'near_ceiling');

  const nearBottom = analyzeMarket(
    [
      candle(0, 110, 100, 110),
      candle(1, 110, 100, 105),
      candle(2, 110, 100, 101),
    ],
    { highs: [], lows: [] },
    1,
    100,
  );
  assert.equal(nearBottom.location, 'near_floor');
});

test('with no pivots it falls back to ATR-sized travel', () => {
  const up = analyzeMarket(
    [
      candle(0, 101, 99, 100),
      candle(1, 103, 101, 102),
      candle(2, 105, 103, 104),
    ],
    { highs: [], lows: [] },
    1,
    100,
  );
  assert.equal(up.state, 'UPTREND');
  assert.match(up.reason, /Too few swing points/);

  const flat = analyzeMarket(
    [
      candle(0, 101, 99, 100),
      candle(1, 101, 99, 100.1),
      candle(2, 101, 99, 100),
    ],
    { highs: [], lows: [] },
    1,
    100,
  );
  assert.equal(flat.state, 'RANGE');
});

test('a zero-span window does not divide by zero', () => {
  const flat = Array.from({ length: 5 }, (_, i) => candle(i, 100, 100, 100));
  const result = analyzeMarket(flat, { highs: [], lows: [] }, 0, 100);
  assert.equal(result.rangePosition, 0.5);
  assert.equal(result.location, 'middle');
});
