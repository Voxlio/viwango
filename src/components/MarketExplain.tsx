'use client';

import type { LevelsResponse } from '@/lib/api-types';
import { explainMarketState, locationLabel, stateLabel } from '@/lib/explain';
import { formatPrice } from '@/lib/format';

/**
 * The market-state explanation, written for someone who has never read a chart.
 * The text is generated from the classification and the range position, so it
 * always matches the numbers shown in the summary card.
 */
export function MarketExplain({ data }: { data: LevelsResponse }) {
  const { market } = data;
  const text = explainMarketState(market.state, market.location, market.rangePosition);
  const precision = data.symbolInfo.pricePrecision;

  const accent = {
    UPTREND: 'border-floor/25',
    DOWNTREND: 'border-ceiling/25',
    RANGE: 'border-white/15',
  }[market.state];

  return (
    <section aria-label="Market state" className={`glass border ${accent} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">Market state</span>
        <span className="text-[11px] text-white/30">
          {Math.round(market.rangePosition * 100)}% up the range
        </span>
      </div>

      <h2 className="display mt-2 text-[26px] sm:text-[30px]">
        {stateLabel(market.state)}
        <span className="text-white/35"> · {locationLabel(market.location)}</span>
      </h2>

      <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">{text}</p>

      {/* A simple visual of where price sits inside its own range. */}
      <div className="mt-4">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-floor/60 via-white/15 to-ceiling/60">
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-950 bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.12)]"
            style={{ left: `${Math.min(100, Math.max(0, market.rangePosition * 100))}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-white/30">
          <span>{formatPrice(market.rangeLow, precision)}</span>
          <span>{formatPrice(market.rangeHigh, precision)}</span>
        </div>
      </div>
    </section>
  );
}
