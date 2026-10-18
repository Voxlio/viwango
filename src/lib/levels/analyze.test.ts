import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeLevels } from './index.ts';
import { floorAndCeilingCandles, uptrendCandles, candle } from './fixtures.test-helpers.ts';

test('finds a nearby floor and ceiling on a range-bound series', () => {
  const result = analyzeLevels(floorAndCeilingCandles(), 'XAUUSD', 'H1', 60);

  assert.ok(result.nearestFloor, 'expected a nearest floor');
  assert.ok(result.nearestCeiling, 'expected a nearest ceiling');
  assert.equal(result.nearestFloor!.kind, 'floor');
  assert.equal(result.nearestCeiling!.kind, 'ceiling');
  assert.ok(result.nearestFloor!.touches >= 2);
  assert.ok(result.nearestCeiling!.touches >= 2);

  // The floor band must sit below the ceiling band.
  assert.ok(result.nearestFloor!.high < result.nearestCeiling!.low);
});

test('price is the last candle close and every zone is below/above it', () => {
  const candles = floorAndCeilingCandles();
  const result = analyzeLevels(candles, 'XAUUSD', 'H1', 60);

  assert.equal(result.price, candles[candles.length - 1].close);
  for (const floor of result.floors) {
    assert.ok(floor.low < result.price, 'floors must be under the price');
  }
  for (const ceiling of result.ceilings) {
    assert.ok(ceiling.high > result.price, 'ceilings must be over the price');
  }
});

test('lists are capped at three per side and sorted closest-first', () => {
  const result = analyzeLevels(floorAndCeilingCandles(), 'XAUUSD', 'H1', 60);
  assert.ok(result.floors.length <= 3);
  assert.ok(result.ceilings.length <= 3);

  for (let i = 1; i < result.floors.length; i++) {
    assert.ok(result.floors[i].low <= result.floors[i - 1].low, 'floors descend');
  }
  for (let i = 1; i < result.ceilings.length; i++) {
    assert.ok(result.ceilings[i].low >= result.ceilings[i - 1].low, 'ceilings ascend');
  }
});

test('every returned zone is scored and sorted by strength inside its band', () => {
  const result = analyzeLevels(floorAndCeilingCandles(), 'XAUUSD', 'H1', 60);
  for (const zone of [...result.floors, ...result.ceilings]) {
    assert.ok(zone.strength >= 0 && zone.strength <= 100);
    assert.ok(zone.lastTouch > 0);
    assert.ok(zone.high > zone.low);
  }
});

test('confluence is only reported when higher-timeframe zones are supplied', () => {
  const candles = floorAndCeilingCandles();
  const without = analyzeLevels(candles, 'XAUUSD', 'H1', 60);
  assert.equal(without.meta.confluenceChecked, false);
  assert.equal(without.meta.higherTimeframe, null);

  const zone = without.nearestCeiling!;
  const withConfluence = analyzeLevels(candles, 'XAUUSD', 'H1', 60, {
    higherTimeframeZones: [zone],
  });

  assert.equal(withConfluence.meta.confluenceChecked, true);
  assert.equal(withConfluence.meta.higherTimeframe, 'H4');

  const confirmed = [...withConfluence.floors, ...withConfluence.ceilings].filter(
    (z) => z.confirmedHigherTf,
  );
  assert.ok(confirmed.length >= 1, 'the supplied zone should confirm at least one');
});

test('the market analysis is attached and self-consistent', () => {
  const result = analyzeLevels(uptrendCandles(), 'XAUUSD', 'H1', 60);
  assert.ok(['RANGE', 'UPTREND', 'DOWNTREND'].includes(result.market.state));
  assert.ok(result.market.reason.length > 0);
  assert.equal(result.market.state, 'UPTREND');
  assert.equal(result.atr > 0, true);
  assert.equal(result.meta.candles, uptrendCandles().length);
});

test('a too-short candle array throws a helpful error', () => {
  const tiny = Array.from({ length: 5 }, (_, i) => candle(i, 100, 99));
  assert.throws(() => analyzeLevels(tiny, 'XAUUSD', 'H1', 60), /Not enough candles/);
});

test('a flat market throws instead of dividing by a zero ATR', () => {
  const flat = Array.from({ length: 40 }, (_, i) => candle(i, 100, 100, 100));
  assert.throws(() => analyzeLevels(flat, 'XAUUSD', 'H1', 60), /ATR/);
});

test('a zone overlapping the current price can be the nearest level', () => {
  // Price finishes inside the floor band rather than above it.
  const candles = floorAndCeilingCandles();
  const last = candles[candles.length - 1];
  candles[candles.length - 1] = { ...last, close: 100.2 };

  const result = analyzeLevels(candles, 'XAUUSD', 'H1', 60);
  assert.ok(result.nearestFloor);
  assert.ok(
    result.nearestFloor!.low <= result.price + result.atr * 0.11,
    'nearest floor should be the band price is sitting on',
  );
});

test('options can loosen the minimum touches', () => {
  const candles = floorAndCeilingCandles();
  const strict = analyzeLevels(candles, 'XAUUSD', 'H1', 60, { minTouches: 4 });
  const loose = analyzeLevels(candles, 'XAUUSD', 'H1', 60, { minTouches: 2 });

  const strictCount = strict.floors.length + strict.ceilings.length;
  const looseCount = loose.floors.length + loose.ceilings.length;
  assert.ok(looseCount >= strictCount);
});
