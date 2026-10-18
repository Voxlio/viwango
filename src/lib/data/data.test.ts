import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateCandles, dropFormingCandle } from './kraken.ts';
import { parseTwelveDataDate } from './twelveData.ts';
import { coinbaseGranularity } from './coinbase.ts';
import { TtlCache, SerialQueue, cachedFetch } from './cache.ts';
import { searchSymbols, findSymbol, SYMBOLS } from '../symbols.ts';
import type { Candle } from '../levels/types.ts';

const c = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time,
  open,
  high,
  low,
  close,
});

test('hourly candles aggregate into aligned 4h buckets', () => {
  // Times 0..3 form the first 4h bucket (0-14399s when scaled by 3600).
  const hours = [
    c(0, 100, 105, 99, 104),
    c(3600, 104, 110, 103, 109),
    c(7200, 109, 112, 108, 108),
    c(10800, 108, 111, 101, 102),
    c(14400, 102, 103, 100, 101), // next bucket
  ];

  const fourHour = aggregateCandles(hours, 14400);

  assert.equal(fourHour.length, 2);
  assert.deepEqual(fourHour[0], { time: 0, open: 100, high: 112, low: 99, close: 102 });
  assert.deepEqual(fourHour[1], { time: 14400, open: 102, high: 103, low: 100, close: 101 });
});

test('aggregation is idempotent when the bucket size matches the candles', () => {
  const candles = [c(0, 1, 2, 0.5, 1.5), c(14400, 1.5, 3, 1, 2)];
  assert.deepEqual(aggregateCandles(candles, 14400), candles);
});

test('aggregation of an empty series is empty', () => {
  assert.deepEqual(aggregateCandles([], 14400), []);
});

test('the forming (unclosed) Kraken candle is dropped', () => {
  const candles = [c(0, 1, 1, 1, 1), c(3600, 2, 2, 2, 2), c(7200, 3, 3, 3, 3)];
  // 7200 started 600s ago, cadence is 3600s -> still open.
  const closed = dropFormingCandle(candles, 7800);
  assert.equal(closed.length, 2);
  assert.equal(closed[closed.length - 1].time, 3600);
});

test('a candle older than one cadence is kept', () => {
  const candles = [c(0, 1, 1, 1, 1), c(3600, 2, 2, 2, 2)];
  const kept = dropFormingCandle(candles, 3600 + 4000);
  assert.equal(kept.length, 2);
});

test('Twelve Data datetimes are parsed as UTC, not server-local', () => {
  assert.equal(parseTwelveDataDate('2024-05-01 12:00:00'), Date.UTC(2024, 4, 1, 12) / 1000);
  assert.equal(parseTwelveDataDate('2024-05-01T12:00:00Z'), Date.UTC(2024, 4, 1, 12) / 1000);
  // A date-only value (daily candles) must land on midnight UTC.
  assert.equal(parseTwelveDataDate('2024-05-01'), Date.UTC(2024, 4, 1) / 1000);
});

test('Coinbase granularity is snapped to a supported value', () => {
  assert.equal(coinbaseGranularity(900), 900);
  assert.equal(coinbaseGranularity(3600), 3600);
  assert.equal(coinbaseGranularity(14400), 3600, '4h is built from 1h candles');
  assert.equal(coinbaseGranularity(86400), 86400);
});

test('cache returns a value inside the TTL and misses afterwards', async () => {
  const cache = new TtlCache<number>(30);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(cache.get('a'), undefined);
});

test('cache evicts the oldest entry beyond its capacity', () => {
  const cache = new TtlCache<number>(60_000, 2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), 3);
});

test('cachedFetch loads once and reports cached on the second call', async () => {
  const cache = new TtlCache<number>(60_000);
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return 42;
  };

  const first = await cachedFetch(cache, 'k', loader);
  const second = await cachedFetch(cache, 'k', loader);

  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.value, 42);
});

test('cachedFetch coalesces concurrent misses into one upstream call', async () => {
  const cache = new TtlCache<number>(60_000);
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return 7;
  };

  const [a, b, c3] = await Promise.all([
    cachedFetch(cache, 'k', loader),
    cachedFetch(cache, 'k', loader),
    cachedFetch(cache, 'k', loader),
  ]);

  assert.equal(calls, 1, 'three callers, one upstream request');
  assert.equal(a.value + b.value + c3.value, 21);
});

test('a failed cachedFetch is not cached and clears the in-flight slot', async () => {
  const cache = new TtlCache<number>(60_000);
  let attempts = 0;
  const loader = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('boom');
    return 5;
  };

  await assert.rejects(() => cachedFetch(cache, 'k', loader), /boom/);
  const retry = await cachedFetch(cache, 'k', loader);
  assert.equal(retry.value, 5);
  assert.equal(attempts, 2);
});

test('SerialQueue runs tasks one at a time, in order', async () => {
  const queue = new SerialQueue();
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;

  const job = (name: string, delay: number) => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    order.push(name);
    active -= 1;
    return name;
  };

  await Promise.all([
    queue.run(job('a', 20)),
    queue.run(job('b', 5)),
    queue.run(job('c', 1)),
  ]);

  assert.equal(maxActive, 1, 'never more than one task in flight');
  assert.deepEqual(order, ['a', 'b', 'c']);
});

test('SerialQueue survives a rejected task', async () => {
  const queue = new SerialQueue();
  await assert.rejects(() => queue.run(async () => { throw new Error('nope'); }), /nope/);
  const value = await queue.run(async () => 'ok');
  assert.equal(value, 'ok');
});

test('symbol search ranks exact ticker matches first', () => {
  assert.equal(searchSymbols('btc')[0].symbol, 'BTCUSD');
  assert.equal(searchSymbols('gold')[0].symbol, 'XAUUSD');
  assert.equal(searchSymbols('aapl')[0].symbol, 'AAPL');
  assert.equal(findSymbol('xauusd')?.symbol, 'XAUUSD');
  assert.equal(findSymbol('notacoin'), undefined);
});

test('every symbol has a source and a sensible precision', () => {
  for (const symbol of SYMBOLS) {
    assert.ok(symbol.dataSource === 'crypto' || symbol.dataSource === 'twelve-data');
    assert.ok(symbol.pricePrecision >= 0 && symbol.pricePrecision <= 6);
  }
});
