'use client';

import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

import type { LevelsResponse } from '@/lib/api-types';
import type { Zone } from '@/lib/levels/types';

/**
 * Candlestick chart with every zone drawn as two dashed horizontal lines — the
 * top and bottom of the band — in red for ceilings and green for floors.
 *
 * Why price lines rather than a separate series per zone: lightweight-charts
 * draws a price line across the whole plot at an exact price with almost no
 * code, and it can never drift out of alignment with the axis. A zone is a
 * *band*, so each one costs two lines; the line style carries the meaning.
 *
 * The chart library is imported normally (not dynamically) because this whole
 * module is only loaded client-side by the parent via `next/dynamic`, which is
 * what actually keeps it out of the server render.
 */

export const FLOOR_COLOR = '#22C77E';
export const CEILING_COLOR = '#F2555A';

export function LevelsChart({ data }: { data: LevelsResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  // Read inside the chart's price formatter, which is created once on mount but
  // must always format with the *current* symbol's precision.
  const precisionRef = useRef(data.symbolInfo.pricePrecision);
  precisionRef.current = data.symbolInfo.pricePrecision;

  // Create the chart once per mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.45)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        rightOffset: 4,
        barSpacing: 6,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.22)', width: 1, style: 3, labelBackgroundColor: '#1b1b22' },
        horzLine: { color: 'rgba(255,255,255,0.22)', width: 1, style: 3, labelBackgroundColor: '#1b1b22' },
      },
      handleScroll: { pressedMouseMove: true, mouseWheel: true, horzTouchDrag: true, vertTouchDrag: false },
      localization: {
        priceFormatter: (price: number) => price.toFixed(precisionRef.current),
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: FLOOR_COLOR,
      downColor: CEILING_COLOR,
      borderUpColor: FLOOR_COLOR,
      borderDownColor: CEILING_COLOR,
      wickUpColor: 'rgba(34,199,126,0.8)',
      wickDownColor: 'rgba(242,85,90,0.8)',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // ResizeObserver keeps the canvas correct for phone rotation and the
    // desktop window resizing, without a global scroll listener.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // The chart instance is intentionally created once; data changes are applied
    // in the effect below so the user's zoom/pan position survives a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push candles, swing markers and zone lines whenever the data changes.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    series.setData(
      data.candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    // Swing points: the raw evidence behind the zones.
    const swingMarkers = [
      ...data.swings.highs.map((point) => ({
        time: point.time as UTCTimestamp,
        position: 'aboveBar' as const,
        color: 'rgba(242,85,90,0.8)',
        shape: 'circle' as const,
      })),
      ...data.swings.lows.map((point) => ({
        time: point.time as UTCTimestamp,
        position: 'belowBar' as const,
        color: 'rgba(34,199,126,0.8)',
        shape: 'circle' as const,
      })),
    ].sort((a, b) => (a.time as number) - (b.time as number));

    series.setMarkers(swingMarkers);

    // One price line per zone edge: top and bottom of each band.
    const allZones: Zone[] = [
      ...data.floors,
      ...data.ceilings,
      ...(data.nearestFloor ? [data.nearestFloor] : []),
      ...(data.nearestCeiling ? [data.nearestCeiling] : []),
    ];

    const seen = new Set<string>();
    for (const zone of allZones) {
      const key = `${zone.kind}:${zone.low}:${zone.high}`;
      // The nearest levels repeat inside floors/ceilings when they are also in
      // the top three, so de-duplicate before drawing.
      if (seen.has(key)) continue;
      seen.add(key);

      const color = zone.kind === 'floor' ? FLOOR_COLOR : CEILING_COLOR;
      const style = LineStyle.Dashed;
      for (const price of [zone.low, zone.high]) {
        series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: style,
          axisLabelVisible: true,
          title: '',
        });
      }
    }

    chart.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[320px] w-full sm:h-[420px]" />

      <Legend floors={data.floors.length} ceilings={data.ceilings.length} />
    </div>
  );
}

function Legend({ floors, ceilings }: { floors: number; ceilings: number }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/45">
      <span className="inline-flex items-center gap-1.5">
        <Dash color={FLOOR_COLOR} />
        Floor zone ({floors})
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dash color={CEILING_COLOR} />
        Ceiling zone ({ceilings})
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        Small dots mark the swing points used
      </span>
    </div>
  );
}

function Dash({ color }: { color: string }) {
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true">
      <line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="1.6" strokeDasharray="4 3" />
    </svg>
  );
}

export default LevelsChart;
