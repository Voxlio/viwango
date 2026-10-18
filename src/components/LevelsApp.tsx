'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LevelsResponse, LevelsApiError } from '@/lib/api-types';
import { isLevelsApiError, isLevelsResponse } from '@/lib/api-types';
import { explainError } from '@/lib/explain';
import { formatDateTime } from '@/lib/format';
import { SYMBOLS } from '@/lib/symbols';
import type { Timeframe } from '@/lib/timeframes';

import { AppFooter } from './Footer';
import { ChartPanel } from './ChartPanel';
import { Header } from './Header';
import { HowToRead } from './HowToRead';
import { MarketExplain } from './MarketExplain';
import { SearchBox } from './SearchBox';
import { SummaryCard } from './SummaryCard';
import { TimeframeSelector } from './TimeframeSelector';
import { ZonesList } from './ZonesList';

interface RequestState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: LevelsResponse | null;
  error: { code: string; message: string } | null;
  /** True while a *refresh* is running and old results are still on screen. */
  refreshing: boolean;
}

/**
 * The whole app: controls on top, results below.
 *
 * Design rules that drove the structure:
 *  - the previous result stays visible while a new one loads (no white flash),
 *  - every failure produces a readable sentence, never a raw stack or code,
 *  - nothing is fetched until the user asks, except one initial XAUUSD/H1 load,
 *  - a superseded request can never overwrite a newer one.
 */
export function LevelsApp() {
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const [confluence, setConfluence] = useState(true);
  const [state, setState] = useState<RequestState>({
    status: 'idle',
    data: null,
    error: null,
    refreshing: false,
  });

  // Monotonic id: the newest request wins, even if an older one answers later.
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (nextSymbol: string, nextTimeframe: Timeframe, useConfluence: boolean, isRefresh = false) => {
      const id = ++requestId.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((previous) => ({
        ...previous,
        status: previous.data ? 'success' : 'loading',
        refreshing: Boolean(previous.data) || isRefresh,
        error: null,
      }));

      const params = new URLSearchParams({
        symbol: nextSymbol,
        tf: nextTimeframe,
        confluence: useConfluence ? '1' : '0',
      });

      try {
        const response = await fetch(`/api/levels?${params.toString()}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });

        // Parse before checking `ok`: error responses carry a JSON body we want.
        const payload: unknown = await response.json().catch(() => null);

        if (id !== requestId.current) return; // a newer request took over

        if (!response.ok || !isLevelsResponse(payload)) {
          const apiError = isLevelsApiError(payload) ? (payload as LevelsApiError).error : null;
          setState((previous) => ({
            ...previous,
            status: 'error',
            refreshing: false,
            error: {
              code: apiError?.code ?? 'UNEXPECTED',
              message:
                apiError?.message ??
                'The server did not return usable level data. Please try again in a moment.',
            },
          }));
          return;
        }

        setState({ status: 'success', data: payload, error: null, refreshing: false });
      } catch (error) {
        if (id !== requestId.current) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setState((previous) => ({
          ...previous,
          status: 'error',
          refreshing: false,
          error: {
            code: 'NETWORK',
            message: 'Could not reach the app. Check your connection and try again.',
          },
        }));
      }
    },
    [],
  );

  // One initial load so the page is never empty on arrival.
  useEffect(() => {
    void load('XAUUSD', 'H1', true);
    return () => abortRef.current?.abort();
  }, [load]);

  const handleSearch = () => {
    void load(symbol, timeframe, confluence);
  };

  const handleSymbolChange = (next: string) => {
    setSymbol(next);
  };

  const handleTimeframeChange = (next: Timeframe) => {
    setTimeframe(next);
    // A timeframe change is an explicit action, so fetch straight away.
    void load(symbol, next, confluence);
  };

  const handleConfluenceToggle = (next: boolean) => {
    setConfluence(next);
    void load(symbol, timeframe, next);
  };

  const scrollToSearch = () => {
    searchAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus the combobox once the scroll has settled, so you can type instantly.
    window.setTimeout(() => {
      const input = searchAnchorRef.current?.querySelector('input');
      input?.focus({ preventScroll: true });
    }, 380);
  };

  const busy = state.status === 'loading' || state.refreshing;
  const data = state.data;
  const selectedSymbol = SYMBOLS.find((entry) => entry.symbol === symbol);

  return (
    <div id="top" className="min-h-dvh">
      <Header onFindLevels={scrollToSearch} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-4 pt-6 sm:px-6 sm:pt-10">
        {/* ---- Hero ------------------------------------------------------ */}
        <section aria-label="Introduction" className="mb-7">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-floor" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
              Floors &amp; ceilings · no AI
            </span>
          </div>
          <h1 className="display mt-3 text-[42px] sm:text-[56px]">
            Find the floor.
            <br />
            <span className="text-white/35">See the ceiling.</span>
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/50">
            Pick an asset and a timeframe. The app finds the price areas where the market has
            repeatedly turned around, scores how much evidence each one has, and tells you where
            price is right now.
          </p>
        </section>

        {/* ---- Controls -------------------------------------------------- */}
        <section
          ref={searchAnchorRef}
          aria-label="Search"
          className="glass mb-4 space-y-3 p-3 sm:p-4"
        >
          <SearchBox
            value={symbol}
            onChange={handleSymbolChange}
            onSubmit={handleSearch}
            busy={busy}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} disabled={busy} />

            <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-white/45">
              <input
                type="checkbox"
                checked={confluence}
                onChange={(event) => handleConfluenceToggle(event.target.checked)}
                className="h-3.5 w-3.5 appearance-none rounded-[4px] border border-white/25 bg-transparent checked:border-floor checked:bg-floor/80 focus-visible:ring-2 focus-visible:ring-white/40"
              />
              Higher-timeframe check
            </label>
          </div>

          {selectedSymbol && (
            <div className="flex flex-wrap items-center gap-2 px-0.5 text-[11px] text-white/30">
              <span className="text-white/55">{selectedSymbol.name}</span>
              <span aria-hidden="true">·</span>
              <span>{budgetNote(selectedSymbol.dataSource)}</span>
            </div>
          )}
        </section>

        {/* ---- Error banner --------------------------------------------- */}
        {state.error && (
          <div
            role="alert"
            className="mb-4 animate-rise rounded-2xl border border-ceiling/30 bg-ceiling/[0.07] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ceiling/20 text-[12px] font-bold text-ceiling">
                !
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed text-white/80">
                  {explainError(state.error.code, state.error.message)}
                </p>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="focus-ring mt-2 rounded-pill border border-white/20 px-3 py-1.5 text-[12px] text-white/75 transition-colors hover:border-white/40 hover:text-white"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Loading (first load only) --------------------------------- */}
        {state.status === 'loading' && <LoadingState symbol={symbol} timeframe={timeframe} />}

        {/* ---- Results --------------------------------------------------- */}
        {data && (
          <div className={`space-y-4 transition-opacity ${state.refreshing ? 'opacity-60' : ''}`}>
            <SummaryCard data={data} />
            <MarketExplain data={data} />
            <ChartPanel data={data} />
            <ZonesList data={data} />

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-white/25">
              <span>
                Source: {sourceLabel(data.meta.source)}
                {data.meta.cached ? ' · served from cache' : ''}
              </span>
              <span>Generated {formatDateTime(Date.parse(data.generatedAt) / 1000)} UTC</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <HowToRead />
        </div>

        <AppFooter />
      </main>
    </div>
  );
}

function budgetNote(source: 'twelve-data' | 'crypto'): string {
  return source === 'crypto'
    ? 'Kraken public data, Coinbase as backup · no key needed'
    : 'Twelve Data free tier · two requests per search';
}

function sourceLabel(source: LevelsResponse['meta']['source']): string {
  switch (source) {
    case 'kraken':
      return 'Kraken (public)';
    case 'coinbase':
      return 'Coinbase Exchange (public)';
    case 'twelve-data':
      return 'Twelve Data';
    default:
      return 'unknown';
  }
}

function LoadingState({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-4">
      <div className="glass space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-6 w-24 rounded-pill" />
        </div>
        <div className="skeleton h-11 w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
        <p className="text-[12px] text-white/35">
          Scanning {symbol} on {timeframe} for floors and ceilings…
        </p>
      </div>
      <div className="skeleton h-[320px] rounded-card sm:h-[420px]" />
      <div className="space-y-2.5">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
      </div>
    </div>
  );
}
