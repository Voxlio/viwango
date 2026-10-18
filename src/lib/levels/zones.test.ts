import test from 'node:test';
import assert from 'node:assert/strict';

import { clusterPivots, clusterToBand, buildZones, isZoneBroken, zonesOverlap } from './zones.ts';
import { pivotsAt, candle, clearableCeilingCandles, floorAndCeilingCandles } from './fixtures.test-helpers.ts';
import { findPivots } from './pivots.ts';
import { latestAtr } from './atr.ts';

test('pivots within the tolerance merge into one cluster', () => {
  const clusters = clusterPivots(pivotsAt([100.3, 99.8, 100.1, 104]), 0.5);

  assert.equal(clusters.length, 2, '104 is far enough away to stand alone');
  assert.equal(clusters[0].prices.length, 3);
  assert.equal(clusters[1].prices.length, 1);
});

test('cluster mean, not the last point, decides membership', () => {
  // Each step is within 0.5 of its neighbour but the whole run drifts by 1.5,
  // so a naive "distance to previous point" rule would merge all of them.
  const clusters = clusterPivots(pivotsAt([100, 100.4, 100.8, 101.2, 101.6]), 0.5);
  assert.ok(clusters.length > 1, 'drifting pivots must not collapse into one blob');
});

test('empty input yields no clusters', () => {
  assert.deepEqual(clusterPivots([], 0.5), []);
});

test('a band spans its members and is padded on both sides', () => {
  const [cluster] = clusterPivots(pivotsAt([99.8, 100.1, 100.3]), 0.5);
  const band = clusterToBand(cluster, 0.2);

  assert.equal(band.low, 99.8 - 0.2);
  assert.equal(band.high, 100.3 + 0.2);
  assert.equal(band.touches, 3);
});

test('band records the most recent touch time', () => {
  const pivots = [
    { index: 0, price: 100, time: 1_700_000_000 },
    { index: 1, price: 100.2, time: 1_700_090_000 },
    { index: 2, price: 99.9, time: 1_700_045_000 },
  ];
  const [cluster] = clusterPivots(pivots, 0.5);
  assert.equal(clusterToBand(cluster, 0).lastTouch, 1_700_090_000);
});

test('single-touch clusters are filtered out by minTouches', () => {
  const candles = floorAndCeilingCandles();
  const atrValue = latestAtr(candles)!;
  const { highs } = findPivots(candles, { lookback: 2 });

  const zones = buildZones(highs, 'ceiling', candles, atrValue, atrValue * 0.5, atrValue * 0.1, 2);
  for (const zone of zones) {
    assert.ok(zone.touches >= 2, 'no single-touch zone may survive');
  }
});

test('a ceiling price has closed beyond once still counts as intact', () => {
  const zone = { kind: 'ceiling' as const, low: 109, high: 111 };
  const candles = [
    candle(0, 112, 108, 110),
    candle(1, 113, 110, 111.5), // first close beyond the band
    candle(2, 114, 111, 112.5), // same episode, still "through"
  ];
  assert.equal(isZoneBroken(zone, candles, 0.5), false);
});

test('a ceiling broken in two separate episodes is discarded', () => {
  const zone = { kind: 'ceiling' as const, low: 109, high: 111 };
  const candles = [
    candle(0, 113, 110, 112), // break 1
    candle(1, 112, 108, 109), // back inside
    candle(2, 114, 110, 113), // break 2
  ];
  assert.equal(isZoneBroken(zone, candles, 0.5), true);
});

test('a floor broken twice is discarded, a floor tested once is kept', () => {
  const zone = { kind: 'floor' as const, low: 99, high: 101 };

  assert.equal(
    isZoneBroken(zone, [candle(0, 100, 96, 97), candle(1, 99, 95, 96)], 0.5),
    false,
  );
  assert.equal(
    isZoneBroken(
      zone,
      [candle(0, 100, 96, 97), candle(1, 100, 99, 100), candle(2, 99, 95, 96)],
      0.5,
    ),
    true,
  );
});

test('closes inside the tolerance band do not count as a break', () => {
  const zone = { kind: 'ceiling' as const, low: 109, high: 111 };
  const candles = [candle(0, 112, 110, 111.2), candle(1, 112, 110, 111.3)];
  assert.equal(isZoneBroken(zone, candles, 0.5), false);
});

test('a ceiling built on repeated 110 touches survives alternating candles', () => {
  const candles = clearableCeilingCandles();
  const zone = { kind: 'ceiling' as const, low: 109, high: 111 };
  assert.equal(isZoneBroken(zone, candles, 0.5), false);
});

test('zonesOverlap detects shared price, including touching edges', () => {
  assert.equal(zonesOverlap({ low: 1, high: 2 }, { low: 1.5, high: 3 }), true);
  assert.equal(zonesOverlap({ low: 1, high: 2 }, { low: 2, high: 3 }), true);
  assert.equal(zonesOverlap({ low: 1, high: 2 }, { low: 2.1, high: 3 }), false);
});
