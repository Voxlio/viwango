import test from 'node:test';
import assert from 'node:assert/strict';

import { findPivots } from './pivots.ts';
import { simplePivotCandles, flatTopCandles, candle } from './fixtures.test-helpers.ts';

test('finds exactly the two constructed pivots with lookback 2', () => {
  const { highs, lows } = findPivots(simplePivotCandles(), { lookback: 2 });

  assert.equal(highs.length, 1, 'one swing high');
  assert.equal(lows.length, 1, 'one swing low');

  assert.equal(highs[0].index, 6);
  assert.equal(highs[0].price, 13, 'uses the wick high, not the close');

  assert.equal(lows[0].index, 2);
  assert.equal(lows[0].price, 1, 'uses the wick low, not the close');
});

test('a flat top yields a single pivot, not one per plateau candle', () => {
  const { highs } = findPivots(flatTopCandles(), { lookback: 2 });

  assert.equal(highs.length, 1, 'one pivot for a three-bar plateau');
  assert.equal(highs[0].price, 110);
  // `>=` on the left and `>` on the right means the LAST bar of a plateau wins:
  // bar 3 fails on its right neighbour (110 >= 110), bar 4 fails on bar 5 too,
  // so only bar 5 has strictly lower highs within `lookback` bars each side.
  assert.equal(highs[0].index, 5);
});

test('the newest `lookback` candles are never confirmed as pivots', () => {
  const candles = simplePivotCandles();
  const { highs, lows } = findPivots(candles, { lookback: 2 });
  const lastAllowedIndex = candles.length - 2 - 1;

  for (const pivot of [...highs, ...lows]) {
    assert.ok(
      pivot.index <= lastAllowedIndex,
      `pivot at ${pivot.index} is too close to the right edge`,
    );
  }
});

test('a rising staircase produces no pivots at all', () => {
  const stairs = Array.from({ length: 12 }, (_, i) => candle(i * 3600, 100 + i, 99 + i, 100 + i));
  const { highs, lows } = findPivots(stairs, { lookback: 2 });

  assert.equal(highs.length, 0);
  assert.equal(lows.length, 0);
});

test('lookback directly controls how many pivots survive', () => {
  const candles = simplePivotCandles();
  const strict = findPivots(candles, { lookback: 3 });
  const loose = findPivots(candles, { lookback: 1 });

  assert.ok(loose.highs.length >= strict.highs.length);
  assert.equal(strict.highs.length, 1);
});

test('returns empty sets for an empty candle array', () => {
  const { highs, lows } = findPivots([], { lookback: 5 });
  assert.deepEqual(highs, []);
  assert.deepEqual(lows, []);
});
