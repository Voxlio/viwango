# PROGRESS

Resume file. If you are picking this up with no chat history, read this first,
then `README.md`. The files on disk are the source of truth.

**Last updated:** 2026-10-18
**Status:** feature-complete against the spec. Algorithm, data layer, API route
and UI are all written. Unit tests pass (68/68). The production build could not
be executed in the sandbox this was verified in — see Known issues.

---

## What is done

**Algorithm** (`src/lib/levels/`) — pure, no I/O, no framework imports.
- `atr.ts` — ATR(14), Wilder smoothing, gap-aware true range.
- `pivots.ts` — wick-based swing highs/lows, N configurable (default 5).
- `zones.ts` — mean-anchored clustering at 0.5 × ATR, padding 0.1 × ATR,
  `minTouches` filter, and a breakout filter that counts *episodes* of closes
  beyond a band rather than bars, discarding a zone after more than one.
- `scoring.ts` — 0–100 strength: touches (max 55), recency (max 30, 100-bar
  half-life), confluence bonus (15).
- `market.ts` — RANGE / UPTREND / DOWNTREND from swing structure plus the last
  100 bars; price location near_floor / middle / near_ceiling at 25%/75%.
- `index.ts` — `analyzeLevels()` orchestration; nearest floor/ceiling, up to 3
  each side, price-inside-a-band handling.
- Tests: `atr`, `pivots`, `zones`, `scoring`, `market`, `analyze` — hand-made
  candle arrays with known answers, plus fixtures helpers.

**Data** (`src/lib/data/`)
- `twelveData.ts` — metals/forex/stocks via `TWELVE_DATA_KEY`.
- `kraken.ts` + `aggregateCandles()` — crypto primary, keyless.
- `coinbase.ts` — crypto fallback, keyless, with local 4h/1w aggregation.
- `cache.ts` — 60s TTL cache + `SerialQueue` so free-tier limits are respected.
- `fetchCandles.ts` — source routing, 500 candles, higher-timeframe fetch that
  never throws (confluence is a bonus, not a dependency).
- `errors.ts` — `DataError` with user-facing messages and HTTP statuses.
- No Binance anywhere.

**API** (`src/app/api/levels/route.ts`)
- `GET /api/levels?symbol=XAUUSD&tf=H1[&confluence=1|0]`
- Validates symbol against the curated list and tf against M15/H1/H4/D1.
- Returns analysis, chart candles, swing points, source, cache status.
- Node runtime, `force-dynamic`, small shared-cache window.

**UI** (`src/components/`, mobile-first dark)
- Sticky header with "Find levels" plus a mobile nav sheet with anchor links.
- `SearchBox` — autocomplete over the curated list, keyboard navigable.
- `TimeframeSelector` — M15/H1/H4/D1 buttons.
- `SummaryCard` — price, nearest floor/ceiling, market state, location.
- `MarketExplain` — plain-English market-state wording.
- `ChartPanel` + `LevelsChart` — lightweight-charts candlesticks, each zone as
  two dashed price lines (red ceiling, green floor), swing markers, legend.
- `ZonesList` — low-high, touches, strength bar, last touch date, per-zone
  plain-English explanation for beginners.
- `HowToRead` — defines floor, ceiling, zone, touches, range, breakout.
- `Footer` — "Educational use only. Levels are zones, not guarantees. Not
  financial advice."
- Loading skeletons, error banner with readable messages, stale-result-while-
  refreshing, request-supersede guard via a monotonic id.

**Supporting**
- `src/lib/symbols.ts` — the curated list (XAUUSD, XAGUSD, EURUSD, GBPUSD,
  USDJPY, BTCUSD, ETHUSD, AAPL, TSLA, NVDA, MSFT). **Edit only this file to add
  symbols.**
- `src/lib/timeframes.ts` — M15/H1/H4/D1 plus W1 as the D1 confluence frame.
- `README.md`, `.env.example` — written/verified against the code.
- No AI provider code, no signal/validation logic, no history — confirmed by
  grep.

---

## Verified in the last session

- `node --test "src/**/*.test.ts"` → **68 tests, 68 pass, 0 fail** (2.7s).
- `tsc --noEmit` (using a global TypeScript, since `node_modules` was absent) →
  no genuine type errors remain. Everything else it reported was missing-package
  noise (`next`, `react`, `@types/*`) that resolves after `npm install`.
- Fixed in this pass: `src/lib/levels/atr.test.ts` — the `approx()` helper used
  `assert.ok(actual !== null)`, which is not a type guard, so `actual - expected`
  was a `TS18047 possibly null` error. Because `tsconfig` includes `**/*.ts`,
  `next build` typechecks test files, so this would have failed the build.
  Replaced with an explicit `if (actual === null) throw`.

---

## What is next

Nothing outstanding against the spec. Optional improvements if you want them:

1. **Confirm the build locally.** The only unverified step is `npm run build`
   (see below). Run it once; if it passes, this project is done.
2. Add more symbols in `src/lib/symbols.ts` as needed.
3. Optional: show the confluence badge directly on the chart legend, not just
   per zone in the list.

---

## Known issues

- **`npm run build` was never executed here.** The sandbox this was verified in
  could not reach the npm registry (`403 Forbidden` on every package, and
  `node_modules` was absent), so `next`/`react`/`lightweight-charts` could not be
  installed. Tests run without dependencies — Node 22 strips TS types natively —
  which is why they could be verified. Type checking was done with a global
  TypeScript compiler instead. **First thing to do on resume: `npm install` then
  `npm run build`.**
- The remaining `tsc` output in that environment (`TS7006` implicit `any` on
  React callback parameters, one `TS2322` on `ZonesList` props) is an artifact of
  `@types/react` being missing, not a code defect. It disappears once
  `node_modules` exists. Worth a glance after install in case one is real.
- `npm run lint` also could not run, for the same reason.
- Twelve Data free tier is 800 requests/day, 8/minute; one search is 2 requests
  with confluence on. Heavy manual testing can exhaust the daily budget.
- The in-memory cache is per serverless instance, so two Vercel instances can
  briefly disagree on a symbol. Accepted trade-off; no database by design.

---

## Exact commands

```bash
cd C:\Users\Mazard\LFINDER

# one-time
cp .env.example .env.local     # then set TWELVE_DATA_KEY=
npm install

# verify (do all four after any change)
npm test
npm run typecheck
npm run lint
npm run build

# develop
npm run dev                    # http://localhost:3000
```

Env: `TWELVE_DATA_KEY` only — needed for metals, forex and stocks. Crypto
(BTCUSD, ETHUSD) works with no key via Kraken, Coinbase as fallback.
