'use client';

import type { LevelsResponse } from '@/lib/api-types';
import type { Zone } from '@/lib/levels/types';
import { formatPercent, formatPrice, relativeTime, strengthLabel } from '@/lib/format';
import { locationLabel, stateLabel } from '@/lib/explain';

/**
 * The summary: current price, the closest floor and ceiling, the market state
 * and where price sits in its range.
 *
 * Hierarchical on purpose — price is the headline, the two nearest levels are
 * the answer to "so what?", and state/location are context underneath.
 */
export function SummaryCard({ data }: { data: LevelsResponse }) {
  const precision = data.symbolInfo.pricePrecision;
  const { nearestFloor, nearestCeiling, market } = data;
  // Percentage change across the whole loaded window, not a daily quote.
  const up = data.changePercent >= 0;

  return (
    <section
      id="summary"
      aria-label="Summary"
      className="glass animate-rise p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label">Current price</span>
            <span className="rounded-pill border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/45">
              {data.symbolInfo.symbol} · {data.timeframe}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="display text-[38px] tabular-nums sm:text-[44px]">
              {formatPrice(data.price, precision)}
            </span>
            <span className={`text-[13px] font-medium tabular-nums ${up ? 'text-floor' : 'text-ceiling'}`}>
              {formatPercent(data.changePercent)}
              <span className="ml-1 font-normal text-white/30">this window</span>
            </span>
          </div>
          <p className="mt-1 text-[12px] text-white/35">
            Last candle {relativeTime(data.meta.lastCandleTime)} · ATR {formatPrice(data.atr, precision)}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={market.state} />
            <LocationPill location={market.location} />
          </div>
          <span className="text-[11px] text-white/30">
            Range {formatPrice(market.rangeLow, precision)} – {formatPrice(market.rangeHigh, precision)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <NearestLevel
          title="Nearest floor"
          hint="Where buyers stepped in before"
          zone={nearestFloor}
          precision={precision}
          tone="floor"
        />
        <NearestLevel
          title="Nearest ceiling"
          hint="Where sellers took over before"
          zone={nearestCeiling}
          precision={precision}
          tone="ceiling"
        />
      </div>

      <p className="mt-4 border-t border-white/[0.07] pt-4 text-[13px] leading-relaxed text-white/55">
        {market.reason}
      </p>
    </section>
  );
}

function NearestLevel({
  title,
  hint,
  zone,
  precision,
  tone,
}: {
  title: string;
  hint: string;
  zone: Zone | null;
  precision: number;
  tone: 'floor' | 'ceiling';
}) {
  const accent = tone === 'floor' ? 'text-floor' : 'text-ceiling';
  const border = tone === 'floor' ? 'border-floor/25' : 'border-ceiling/25';
  const dot = tone === 'floor' ? 'bg-floor' : 'bg-ceiling';

  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.02] p-4`}>
      <div className="flex items-center gap-2">
        <span className={`pill-dot ${dot}`} />
        <span className="label">{title}</span>
      </div>

      {zone ? (
        <>
          <div className={`mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight ${accent}`}>
            {formatPrice(zone.low, precision)} – {formatPrice(zone.high, precision)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/45">
            <span>
              {zone.touches} {zone.touches === 1 ? 'touch' : 'touches'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{strengthLabel(zone.strength)} ({zone.strength}/100)</span>
            {zone.confirmedHigherTf && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-white/70">also seen one timeframe up</span>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-1.5 text-[19px] font-medium text-white/40">None found</div>
          <div className="mt-1 text-[12px] text-white/35">{hint}</div>
        </>
      )}
    </div>
  );
}

function StatePill({ state }: { state: LevelsResponse['market']['state'] }) {
  const styles = {
    UPTREND: 'border-floor/35 text-floor',
    DOWNTREND: 'border-ceiling/35 text-ceiling',
    RANGE: 'border-white/20 text-white/70',
  }[state];

  const dot = {
    UPTREND: 'bg-floor',
    DOWNTREND: 'bg-ceiling',
    RANGE: 'bg-white/50',
  }[state];

  return (
    <span className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12px] font-medium ${styles}`}>
      <span className={`pill-dot ${dot}`} />
      {stateLabel(state)}
    </span>
  );
}

function LocationPill({ location }: { location: LevelsResponse['market']['location'] }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-white/[0.12] px-3 py-1.5 text-[12px] font-medium text-white/65">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {locationLabel(location)}
    </span>
  );
}
