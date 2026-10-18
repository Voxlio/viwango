# VIWANGO

Floors and ceilings for any asset, computed from plain candle maths.

Search an asset, pick a timeframe, and VIWANGO finds the price areas where the
market has repeatedly turned around — then scores how much evidence each one
has and tells you where price is sitting right now.

There is no AI in this app. Every number on the screen comes from deterministic
code in `src/lib/levels/`, covered by unit tests with hand-made candle arrays.

---

## Keys you need

Just one: **`TWELVE_DATA_KEY`** — free from
[twelvedata.com](https://twelvedata.com/pricing).

It covers gold, silver, forex and stocks. Crypto (BTCUSD, ETHUSD) uses Kraken's
public OHLC endpoint with Coinbase Exchange as a fallback — **no key required**.

| Variable | Required | Used for | Where to get it |
| --- | --- | --- | --- |
| `TWELVE_DATA_KEY` | Yes, for metals / forex / stocks | Twelve Data time series | https://twelvedata.com/pricing (free tier) |

The key is only ever read server-side in the API route
(`src/app/api/levels/route.ts`). Nothing in the client bundle references it.

Free-tier limits: 800 requests/day and 8 requests/minute. One search costs one
request, or two when the higher-timeframe confluence check is on (the default).
Responses are cached in memory for 60 seconds, and upstream calls are queued so
a single search never bursts past the per-minute budget.

---

## Run it locally

```bash
cd C:\Users\Mazard\LFINDER
cp .env.example .env.local     # then paste your key after TWELVE_DATA_KEY=
npm install
npm run dev                    # http://localhost:3000
```

Other commands:

```bash
npm test        # unit tests (68 tests, node's built-in test runner)
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
npm start           # serve the production build
```

Requires **Node 22.18+** — the tests run `.ts` files directly via Node's
built-in type stripping, so there is no test framework to install.

To try the crypto path without any key at all:

```bash
npm run dev
# then search BTCUSD or ETHUSD — Kraken public data, no .env needed
```

---

## Deploy to Vercel (free Hobby tier)

1. Push the folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel: **Add New → Project**, import the repo. Framework preset is
   detected as Next.js; no build settings need changing.
3. Under **Settings → Environment Variables**, add `TWELVE_DATA_KEY` with your
   key, for Production (and Preview if you want previews to work).
4. Deploy.

The API route declares `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`,
so it always runs on a Node function rather than being cached at the edge.
Shared caches are told to hold a response for 30 seconds
(`s-maxage=30, stale-while-revalidate=30`), which keeps repeat searches cheap
against the free tier.

---

## How the algorithm works

All of it lives in `src/lib/levels/` and every step is a pure function.

**1. ATR(14).** Average True Range over 14 candles, Wilder-smoothed. True range
accounts for gaps via the previous close, so a weekend gap in gold widens ATR
the way a trader would expect. ATR is the unit of distance for everything that
follows — that is what makes one set of settings work for gold at 2,400 and
Bitcoin at 60,000.

**2. Swings (pivots).** A candle is a swing high when its **wick** high is the
extreme of the N candles on each side (N defaults to 5, configurable). Swing
lows are the mirror image. Wicks, not closes, because a rejection is defined by
how far price reached, not where it settled.

**3. Clustering.** Individual swing prices never land on the same number, so a
"level" is really a band. Swing prices are sorted ascending and a new cluster
starts whenever the next price is further than **0.5 × ATR** from the running
cluster *mean*. Using the mean rather than the last price stops a slow drift of
many pivots being swallowed into one enormous zone. Each finished cluster
becomes a band spanning its lowest and highest member, padded by **0.1 × ATR**
on both sides.

**4. Scoring, 0–100.** Three ingredients, weighted so that "how many times did
price turn here" dominates:

| Component | Max | How it works |
| --- | --- | --- |
| Touches | 55 | 2 touches = 28 points, each extra adds 9, caps at 6 touches |
| Recency | 30 | Halves every 100 bars since the last touch |
| Confluence | 15 | Flat bonus when a same-kind zone from the next higher timeframe overlaps |

The touch curve starts at 28 rather than 0 because a zone only reaches scoring
with at least two swings — the minimum case should read as "worth watching",
not "worthless". The confluence bonus is a bonus, not the whole story, so a
strong single-timeframe zone is never buried by a weak one that happens to
overlap a higher frame. Confluence costs one extra API call and can be switched
off with the checkbox in the UI, or `&confluence=0` on the API.

**5. Filtering.** Zones need at least **2 touches** to appear. A zone is
discarded when price has clearly broken through it — closed beyond the band by
more than a small tolerance — **more than once**. A single pierce is a test; two
clean closes beyond it is a level that has stopped working.

**6. Market state.** Classified as `RANGE`, `UPTREND` or `DOWNTREND` from swing
structure (higher highs and higher lows, or lower highs and lower lows) combined
with the price range of the last ~100 candles. Separately, price location is
reported as near floor, in the middle, or near ceiling.

Nearest floor is the highest floor band at or below price; if price is
*inside* a band (within 0.1 × ATR of it), that band is the active floor, since
it is the level being tested right now. Nearest ceiling is the mirror image.
Up to three floors below and three ceilings above are also returned, closest
first.

### API

```
GET /api/levels?symbol=XAUUSD&tf=H1
GET /api/levels?symbol=BTCUSD&tf=H4&confluence=0
```

`symbol` must be in the curated list, `tf` must be one of `M15`, `H1`, `H4`,
`D1`. Both are validated and produce a readable error rather than a stack trace.
The response carries the analysis, the candles for the chart, the swing points,
and which upstream source answered.

### Extending the symbol list

Edit `src/lib/symbols.ts`. Each entry needs a `symbol`, `name`, `kind`,
`dataSource` (`'twelve-data'` or `'crypto'`) and `pricePrecision`, plus the
provider's own ticker in `providerSymbol` when it differs. Nothing else needs to
change — the search box, validation and data layer all read from that list.

---

## Limitations

Levels are **zones, not lines, and not guarantees**. Specific things worth
knowing:

- **Free-tier data is not tick data.** Twelve Data's free plan serves delayed
  and possibly aggregated candles; the newest bar may not be final.
- **500 candles is a short history.** On D1 that is about two years, which is
  enough for swing structure but misses older levels entirely.
- **Confluence is one timeframe up, not many.** M15→H1→H4→D1→W1. A zone that
  lines up across three frames is not detected as such.
- **Weekly candles are thin.** The D1 confluence check fetches W1, and Crypto
  weekly data from Coinbase is aggregated locally; either can come back too
  short, in which case confluence is silently skipped and the badge is simply
  absent.
- **No volume, no order book.** Touch counts are purely price-based, so a busy
  zone and a thin one with the same swing count score alike.
- **Breakouts are judged on closes.** A violent wick through a zone that closes
  back inside does not count as a break — deliberately, but it does mean a
  genuine fast breakdown can leave a stale zone standing for a while.
- **One process, in-memory cache.** On Vercel each serverless instance keeps its
  own 60-second cache, so two instances can briefly disagree. That is fine for
  this app and avoids a database.

---

## Project layout

```
src/
  app/
    api/levels/route.ts   the single API route: validation + orchestration
    layout.tsx, page.tsx  shell and page
    globals.css           dark theme tokens and shared classes
  components/             UI: search, timeframe buttons, summary, chart, zones
  lib/
    levels/               the algorithm — atr, pivots, zones, scoring, market
      *.test.ts           unit tests with hand-made candle arrays
    data/                 providers, cache, serial queue, error mapping
    symbols.ts            curated symbol list (the one file to edit)
    timeframes.ts         M15/H1/H4/D1 + the extra W1 confluence frame
```

The algorithm modules are pure and have no knowledge of HTTP; the data modules
have no knowledge of the maths. That split is what makes the tests fast and the
route short.

---

Educational use only. Levels are zones, not guarantees. Not financial advice.
