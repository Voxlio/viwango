import { NextResponse } from 'next/server';

import { findSymbol, SYMBOLS } from '@/lib/symbols';
import { isTimeframe, TIMEFRAMES, TIMEFRAME_ORDER, type Timeframe } from '@/lib/timeframes';
import { analyzeLevels, findPivots } from '@/lib/levels';
import type { Candle, Zone } from '@/lib/levels/types';
import { getCandles, getHigherTimeframeCandles } from '@/lib/data/fetchCandles';
import { DataError } from '@/lib/data/errors';

/**
 * GET /api/levels?symbol=XAUUSD&tf=H1[&confluence=1]
 *
 * Everything the UI needs in one round trip: the analysis, the candles for the
 * chart, and the swing points so the chart can mark them.
 *
 * The route only orchestrates. All maths lives in src/lib/levels, all network
 * access in src/lib/data, so this file stays readable and easy to validate.
 */

export const runtime = 'nodejs';
// Always run fresh: the app has its own 60s cache and must see upstream errors.
export const dynamic = 'force-dynamic';

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

function badRequest(message: string, code = 'INVALID_INPUT') {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status: 400 });
}

/** Keep the payload small: 500 candles plus zones is still well under 100 KB. */
function toChartCandles(candles: Candle[]): Candle[] {
  return candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // ---- Input validation -------------------------------------------------
  const rawSymbol = (url.searchParams.get('symbol') ?? '').trim();
  if (!rawSymbol) {
    return badRequest(
      `Missing "symbol". Try one of: ${SYMBOLS.slice(0, 5).map((s) => s.symbol).join(', ')}.`,
    );
  }

  const symbol = findSymbol(rawSymbol);
  if (!symbol) {
    return badRequest(
      `"${rawSymbol.toUpperCase()}" is not in the supported symbol list. Available: ${SYMBOLS.map((s) => s.symbol).join(', ')}.`,
      'UNKNOWN_SYMBOL',
    );
  }

  const rawTf = (url.searchParams.get('tf') ?? 'H1').trim().toUpperCase();
  if (!isTimeframe(rawTf)) {
    return badRequest(
      `"${rawTf}" is not a valid timeframe. Use one of: ${TIMEFRAME_ORDER.join(', ')}.`,
      'UNKNOWN_TIMEFRAME',
    );
  }
  const timeframe: Timeframe = rawTf;

  // Confluence is on unless explicitly turned off; it costs one extra request.
  const confluenceParam = url.searchParams.get('confluence');
  const confluenceEnabled = confluenceParam !== '0' && confluenceParam !== 'false';

  const twelveDataKey = process.env.TWELVE_DATA_KEY;

  // ---- Data + analysis --------------------------------------------------
  try {
    const primary = await getCandles(symbol, timeframe, twelveDataKey);

    if (primary.candles.length < 30) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'NO_DATA',
            message: `Only ${primary.candles.length} candles came back for ${symbol.symbol}. Try a shorter timeframe or another symbol.`,
          },
        },
        { status: 404 },
      );
    }

    // Sequential by design: the higher-timeframe call only starts after the
    // primary one settles, to stay inside the free tier's per-minute budget.
    const higher = confluenceEnabled
      ? await getHigherTimeframeCandles(symbol, TIMEFRAMES[timeframe].higher, twelveDataKey)
      : null;

    // Zones from the higher timeframe are precomputed with the same rules and
    // used only for the confluence bonus — they are not shown in the UI.
    let higherZones: Zone[] | null = null;
    if (higher) {
      try {
        const higherAnalysis = analyzeLevels(
          higher.candles,
          symbol.symbol,
          higher.timeframe === 'W1' ? 'D1' : higher.timeframe,
          higher.timeframe === 'W1' ? 10080 : TIMEFRAMES[higher.timeframe].minutes,
        );
        higherZones = [...higherAnalysis.floors, ...higherAnalysis.ceilings];
      } catch {
        // A too-short or flat higher series simply means no confluence data.
        higherZones = null;
      }
    }

    const result = analyzeLevels(primary.candles, symbol.symbol, timeframe, TIMEFRAMES[timeframe].minutes, {
      higherTimeframeZones: higherZones,
    });

    const pivots = findPivots(primary.candles, { lookback: 5 });
    const lastClose = primary.candles[primary.candles.length - 1].close;
    const firstClose = primary.candles[0].close;

    return NextResponse.json(
      {
        ...result,
        meta: {
          ...result.meta,
          cached: primary.cached,
          source: primary.source,
        },
        symbolInfo: {
          symbol: symbol.symbol,
          name: symbol.name,
          kind: symbol.kind,
          pricePrecision: symbol.pricePrecision,
        },
        candles: toChartCandles(primary.candles),
        // Swing points, so the chart can mark where price actually turned.
        swings: {
          highs: pivots.highs.map((p) => ({ time: p.time, price: p.price })),
          lows: pivots.lows.map((p) => ({ time: p.time, price: p.price })),
        },
        changePercent: firstClose !== 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0,
        generatedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // Let shared caches hold it briefly, but never serve stale level data
          // for long: the analysis is only meaningful while it is current.
          'cache-control': 'public, s-maxage=30, stale-while-revalidate=30',
        },
      },
    );
  } catch (error) {
    if (error instanceof DataError) {
      return NextResponse.json<ApiError>(
        { error: { code: error.code, message: error.userMessage } },
        { status: error.status },
      );
    }

    // Unknown symbols reaching a keyless provider are the most likely surprise.
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (/not enough candles|ATR/i.test(message)) {
      return NextResponse.json<ApiError>(
        {
          error: {
            code: 'INSUFFICIENT_DATA',
            message:
              'There were not enough usable candles to find levels. Try a longer timeframe or another symbol.',
          },
        },
        { status: 422 },
      );
    }

    console.error('[api/levels] unexpected failure', error);
    return NextResponse.json<ApiError>(
      {
        error: {
          code: 'INTERNAL',
          message: 'Something went wrong while computing levels. Please try again.',
        },
      },
      { status: 500 },
    );
  }
}
