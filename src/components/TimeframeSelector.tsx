'use client';

import { TIMEFRAME_ORDER, type Timeframe } from '@/lib/timeframes';

/**
 * Timeframe selector. Four buttons, one active. The bar under the active label
 * echoes the reference screens' pill rows without adding another row of chrome.
 */
export function TimeframeSelector({
  value,
  onChange,
  disabled,
}: {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  disabled?: boolean;
}) {
  const descriptions: Record<Timeframe, string> = {
    M15: '15 minutes per candle',
    H1: '1 hour per candle',
    H4: '4 hours per candle',
    D1: '1 day per candle',
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Timeframe">
      {TIMEFRAME_ORDER.map((timeframe) => {
        const active = timeframe === value;
        return (
          <button
            key={timeframe}
            type="button"
            aria-pressed={active}
            title={descriptions[timeframe]}
            disabled={disabled}
            onClick={() => onChange(timeframe)}
            className={`focus-ring rounded-pill px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
              active
                ? 'bg-white text-ink-950'
                : 'border border-white/[0.12] text-white/65 hover:border-white/25 hover:text-white'
            }`}
          >
            {timeframe}
          </button>
        );
      })}
      <span className="ml-1 hidden text-[11px] text-white/30 sm:inline">
        {descriptions[value]} · ~500 candles
      </span>
    </div>
  );
}
