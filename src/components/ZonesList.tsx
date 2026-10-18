'use client';

import { useState } from 'react';

import type { LevelsResponse } from '@/lib/api-types';
import type { Zone } from '@/lib/levels/types';
import { explainZone } from '@/lib/explain';
import { formatDate, formatPrice, relativeTime, strengthLabel } from '@/lib/format';

/**
 * The zone list: every level the scanner kept, with the evidence behind it and
 * a plain-English explanation that can be expanded per zone.
 *
 * Ceilings are listed top-down (furthest above price first) and floors
 * bottom-up, so the list reads outward from the current price.
 */
export function ZonesList({ data }: { data: LevelsResponse }) {
  const precision = data.symbolInfo.pricePrecision;
  const floors = [...data.floors].reverse(); // furthest below first
  const ceilings = [...data.ceilings].reverse(); // furthest above first

  return (
    <section id="zones" aria-label="Zones" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="display text-[26px] sm:text-[30px]">Zones</h2>
          <p className="mt-1 text-[13px] text-white/45">
            Ordered outward from the current price. Tap a zone to read what it means.
          </p>
        </div>
        <span className="rounded-pill border border-white/[0.12] px-3 py-1.5 text-[11px] text-white/45">
          {data.floors.length + data.ceilings.length} found
        </span>
      </div>

      {data.ceilings.length === 0 && data.floors.length === 0 ? (
        <EmptyZones />
      ) : (
        <div className="space-y-2.5">
          {ceilings.length > 0 && (
            <GroupHeading tone="ceiling" count={ceilings.length} label="Above price" />
          )}
          {ceilings.map((zone, index) => (
            <ZoneRow key={`ceiling-${index}-${zone.low}`} zone={zone} precision={precision} />
          ))}

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Current price</span>
            <span className="text-[11px] tabular-nums text-white/60">
              {formatPrice(data.price, precision)}
            </span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {floors.length > 0 && (
            <GroupHeading tone="floor" count={floors.length} label="Below price" />
          )}
          {floors.map((zone, index) => (
            <ZoneRow key={`floor-${index}-${zone.low}`} zone={zone} precision={precision} />
          ))}

          <p className="pt-1 text-[11px] text-white/30">
            Zones with fewer than two touches are hidden, and zones price has already broken through
            twice are dropped.
          </p>
        </div>
      )}
    </section>
  );
}

function GroupHeading({
  tone,
  count,
  label,
}: {
  tone: 'floor' | 'ceiling';
  count: number;
  label: string;
}) {
  const dot = tone === 'floor' ? 'bg-floor' : 'bg-ceiling';
  const text = tone === 'floor' ? 'text-floor' : 'text-ceiling';
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={`pill-dot ${dot}`} />
      <span className={`text-[11px] font-medium uppercase tracking-[0.14em] ${text}`}>
        {label} · {count} {count === 1 ? 'zone' : 'zones'}
      </span>
    </div>
  );
}

function ZoneRow({ zone, precision }: { zone: Zone; precision: number }) {
  const [open, setOpen] = useState(false);
  const isFloor = zone.kind === 'floor';
  const accentText = isFloor ? 'text-floor' : 'text-ceiling';
  const barColor = isFloor ? 'bg-floor' : 'bg-ceiling';
  const explanation = explainZone(zone, precision);

  return (
    <div className="glass-tight overflow-hidden transition-colors hover:border-white/20">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring block w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`pill-dot ${isFloor ? 'bg-floor' : 'bg-ceiling'}`} />
              <span className={`text-[11px] font-medium uppercase tracking-[0.14em] ${accentText}`}>
                {isFloor ? 'Floor' : 'Ceiling'}
              </span>
              {zone.confirmedHigherTf && (
                <span className="rounded-pill border border-white/15 px-2 py-[2px] text-[9px] uppercase tracking-[0.1em] text-white/55">
                  higher TF
                </span>
              )}
            </div>

            <div className="mt-1.5 truncate text-[19px] font-semibold tabular-nums tracking-tight">
              {formatPrice(zone.low, precision)}
              <span className="mx-1.5 text-white/25">–</span>
              {formatPrice(zone.high, precision)}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[13px] font-medium text-white/85">
              {zone.touches} {zone.touches === 1 ? 'touch' : 'touches'}
            </div>
            <div className="mt-0.5 text-[11px] text-white/35">
              last {formatDate(zone.lastTouch)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.max(4, zone.strength)}%` }}
            />
          </div>
          <span className="w-[92px] shrink-0 text-right text-[11px] text-white/45">
            {strengthLabel(zone.strength)} · {zone.strength}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/30">
          <span>{relativeTime(zone.lastTouch)}</span>
          <span className="inline-flex items-center gap-1">
            {open ? 'Hide explanation' : 'What does this mean?'}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {open && (
        <div className="animate-rise border-t border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <p className="text-[13px] leading-relaxed text-white/60">{explanation}</p>
        </div>
      )}
    </div>
  );
}

function EmptyZones() {
  return (
    <div className="glass p-6 text-center">
      <p className="text-[15px] font-medium">No clean zones on this timeframe</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/45">
        Every zone either had fewer than two touches or had already been broken twice. That usually
        means price is trending hard. Try a higher timeframe — bigger candles produce cleaner levels.
      </p>
    </div>
  );
}
