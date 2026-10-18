import test from 'node:test';
import assert from 'node:assert/strict';

import { touchScore, recencyScore, scoreZone, confluenceScore, scoreZones } from './scoring.ts';
import type { Zone } from './types.ts';

const baseZone: Zone = {
  kind: 'floor',
  low: 99,
  high: 101,
  touches: 2,
  lastTouch: 1_700_000_000,
  strength: 0,
  confirmedHigherTf: false,
  memberPrices: [99.2, 100.1],
};

test('touch score rises with each touch and caps at 55', () => {
  assert.equal(touchScore(2), 28);
  assert.equal(touchScore(3), 37);
  assert.equal(touchScore(4), 46);
  assert.equal(touchScore(6), 55);
  assert.equal(touchScore(20), 55, 'never exceeds the touches weight');
});

test('touch score never goes negative for degenerate input', () => {
  assert.ok(touchScore(0) >= 0);
  assert.ok(touchScore(-5) >= 0);
});

test('recency halves after the half-life in bars', () => {
  const now = 1_700_000_000;
  const hour = 3600;

  const fresh = recencyScore(now, now, 60);
  const halfLife = recencyScore(now - 100 * hour, now, 60);
  const twoHalfLives = recencyScore(now - 200 * hour, now, 60);

  assert.ok(Math.abs(fresh - 30) < 1e-9);
  assert.ok(Math.abs(halfLife - 15) < 1e-6);
  assert.ok(Math.abs(twoHalfLives - 7.5) < 1e-6);
});

test('recency clamps future timestamps to full marks', () => {
  assert.ok(Math.abs(recencyScore(2_000, 1_000, 60) - 30) < 1e-9);
});

test('confluence needs an overlapping zone of the same kind', () => {
  const overlapping: Zone = { ...baseZone, kind: 'floor', low: 100.5, high: 102 };
  const opposite: Zone = { ...baseZone, kind: 'ceiling', low: 100.5, high: 102 };

  assert.deepEqual(confluenceScore(baseZone, [overlapping]), { points: 15, confirmed: true });
  assert.deepEqual(confluenceScore(baseZone, [opposite]), { points: 0, confirmed: false });
  assert.deepEqual(confluenceScore(baseZone, null), { points: 0, confirmed: false });
  assert.deepEqual(confluenceScore(baseZone, []), { points: 0, confirmed: false });
});

test('a two-touch zone at the newest bar scores 28 + 30 = 58', () => {
  const now = 1_700_000_000;
  const scored = scoreZone({ ...baseZone, lastTouch: now }, { now, timeframeMinutes: 60 });

  assert.equal(scored.strength, 58);
  assert.equal(scored.confirmedHigherTf, false);
});

test('an older three-touch zone without confluence scores 37 + 15 = 52', () => {
  const now = 1_700_000_000;
  const scored = scoreZone(
    { ...baseZone, touches: 3, lastTouch: now - 100 * 3600 },
    { now, timeframeMinutes: 60 },
  );
  assert.equal(scored.strength, 52);
});

test('confluence adds exactly 15 points and flags the zone', () => {
  const now = 1_700_000_000;
  const higher: Zone[] = [{ ...baseZone, kind: 'floor', low: 99.5, high: 100.5 }];
  const scored = scoreZone(
    { ...baseZone, touches: 3, lastTouch: now - 100 * 3600 },
    { now, timeframeMinutes: 60, higherZones: higher },
  );

  assert.equal(scored.strength, 67);
  assert.equal(scored.confirmedHigherTf, true);
});

test('strength always stays inside 0-100', () => {
  const now = 1_700_000_000;
  const strong = scoreZone(
    { ...baseZone, touches: 50, lastTouch: now },
    { now, timeframeMinutes: 15, higherZones: [{ ...baseZone, low: 99, high: 101 }] },
  );
  assert.ok(strong.strength <= 100);

  const weak = scoreZone(
    { ...baseZone, touches: 1, lastTouch: now - 5000 * 3600 },
    { now, timeframeMinutes: 60 },
  );
  assert.ok(weak.strength >= 0);
});

test('scoring does not mutate the input zone', () => {
  const zone = { ...baseZone };
  scoreZone(zone, { now: zone.lastTouch, timeframeMinutes: 60 });
  assert.equal(zone.strength, 0);
});

test('scoreZones maps every zone', () => {
  const now = 1_700_000_000;
  const scored = scoreZones([{ ...baseZone, lastTouch: now }], { now, timeframeMinutes: 60 });
  assert.equal(scored.length, 1);
  assert.equal(scored[0].strength, 58);
});
