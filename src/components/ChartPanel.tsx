'use client';

import dynamic from 'next/dynamic';

import type { LevelsResponse } from '@/lib/api-types';

/**
 * `lightweight-charts` touches `window` while it initialises, so the chart is
 * loaded with `ssr: false`. The placeholder keeps the exact height, which stops
 * the page jumping when the chart arrives — a real annoyance on a phone.
 */
const Chart = dynamic(() => import('@/components/LevelsChart'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <div className="skeleton h-[320px] w-full rounded-2xl sm:h-[420px]" />
      <div className="flex gap-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-24" />
      </div>
    </div>
  ),
});

export function ChartPanel({ data }: { data: LevelsResponse }) {
  return (
    <section id="chart" aria-label="Chart" className="glass p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-[15px] font-semibold">Price and zones</h2>
          <p className="text-[11px] text-white/35">
            {data.symbolInfo.symbol} · {data.timeframe} · dashed lines are the top and bottom of each zone
          </p>
        </div>
        <span className="rounded-pill border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-white/35">
          {data.meta.candles} candles
        </span>
      </div>
      <Chart data={data} />
    </section>
  );
}
