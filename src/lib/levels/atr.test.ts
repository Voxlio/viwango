import test from 'node:test';
import assert from 'node:assert/strict';

import { atr, latestAtr } from './atr.ts';
import { constantRangeCandles, gappedCandles } from './fixtures.test-helpers.ts';

const approx = (actual: number | null, expected: number, epsilon = 1e-9) => {
  // A plain guard rather than assert.ok: only this narrows `actual` to number
  // for the arithmetic below, so `tsc` stays happy (assert is not a type guard).
  if (actual === null) throw new Error('expected a number, got null');
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${expected} +/- ${epsilon}, got ${actual}`,
  );
};

test('ATR is null until the first full period is available', () => {
  const series = atr(constantRangeCandles(), 14);
  assert.equal(series.length, 16);
  for (let i = 0; i < 14; i++) {
    assert.equal(series[i], null, `index ${i} should be null`);
  }
  assert.notEqual(series[14], null);
});

test('ATR of a constant 2.0 true range is exactly 2.0', () => {
  const series = atr(constantRangeCandles(), 14);
  approx(series[14], 2);
  approx(series[15], 2);
});

test('a price gap widens ATR through the previous close', () => {
  const series = atr(gappedCandles(), 14);

  // Bar 1 gaps from a close of 100 to a high of 123 / low of 121:
  // true range = max(2, 23, 21) = 23. The other 14 bars contribute 2 each.
  const seed = (23 + 2 * 13) / 14;
  approx(series[14], seed);

  // Wilder smoothing on the next true range of 2.
  const next = (seed * 13 + 2) / 14;
  approx(series[15], next);
});

test('ATR of a perfectly flat series is zero and latestAtr reports it', () => {
  const flat = Array.from({ length: 20 }, (_, i) => ({
    time: i * 3600,
    open: 50,
    high: 50,
    low: 50,
    close: 50,
  }));
  approx(latestAtr(flat, 14), 0);
});

test('latestAtr returns null when there are too few candles', () => {
  const few = constantRangeCandles().slice(0, 5);
  assert.equal(latestAtr(few, 14), null);
});
