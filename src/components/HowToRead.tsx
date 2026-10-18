'use client';

import { useState } from 'react';

/**
 * "How to read this" — the glossary.
 *
 * Collapsible so it never buries the actual results on a phone, but expanded by
 * default on wide screens where there is room. The definitions are the ones a
 * complete beginner needs, in the order they will meet them.
 */

const TERMS: { term: string; tone: 'floor' | 'ceiling' | 'neutral'; body: string }[] = [
  {
    term: 'Floor',
    tone: 'floor',
    body: 'A price area where buyers have stepped in before and pushed the price back up. Think of it as a floor under the price: falling into it has tended to stop the fall. Traders call this "support".',
  },
  {
    term: 'Ceiling',
    tone: 'ceiling',
    body: 'A price area where sellers have taken over before and pushed the price back down. Think of it as a lid over the price. Traders call this "resistance".',
  },
  {
    term: 'Zone',
    tone: 'neutral',
    body: 'Not a single exact price, but a band with a top and a bottom. Buyers and sellers never agree on the exact same number twice, so "2,318.40 – 2,324.90" is more honest than "2,320". Being anywhere inside the band counts as being at the level.',
  },
  {
    term: 'Touch',
    tone: 'neutral',
    body: 'Each time the price came into a zone and turned around. Three touches means the market respected that area three separate times. More touches generally means a stronger level — though every level eventually breaks, and a level that has been touched many times often snaps harder when it finally gives way.',
  },
  {
    term: 'Strength',
    tone: 'neutral',
    body: 'A 0–100 score from three things: how many touches the zone has, how recently it was last tested, and whether the same zone also exists on a higher timeframe. Higher is not "safer" — it means more evidence.',
  },
  {
    term: 'Range',
    tone: 'neutral',
    body: 'When the price bounces between a floor and a ceiling instead of going somewhere new. In a range, the top and bottom tend to keep working. "Price is in the middle" means it is between the two, where there is no clear edge either way.',
  },
  {
    term: 'Breakout',
    tone: 'neutral',
    body: 'When the price goes through a zone and stays gone — closing clearly beyond it more than once. That usually means the floor or ceiling has stopped working, and it often becomes the opposite (an old ceiling can act as a new floor). This tool removes zones that have clearly broken.',
  },
  {
    term: 'ATR',
    tone: 'neutral',
    body: 'Average True Range: the average distance a candle travels from its high to its low. It is the yardstick this tool uses to decide how close two swing points must be to count as the same zone. Big ATR means a wide, noisy market and wider zones.',
  },
];

export function HowToRead({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id="guide" aria-label="How to read this" className="glass overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
      >
        <div>
          <h2 className="display text-[26px] sm:text-[30px]">How to read this</h2>
          <p className="mt-1 text-[13px] text-white/45">
            Eight words, explained for someone who has never opened a chart.
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white/60">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`transition-transform ${open ? 'rotate-45' : ''}`}
          >
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="animate-rise grid gap-2.5 border-t border-white/[0.07] p-4 sm:grid-cols-2 sm:p-6">
          {TERMS.map((item) => (
            <div
              key={item.term}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <div className="flex items-center gap-2">
                {item.tone !== 'neutral' && (
                  <span className={`pill-dot ${item.tone === 'floor' ? 'bg-floor' : 'bg-ceiling'}`} />
                )}
                <h3 className="text-[14px] font-semibold">{item.term}</h3>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">{item.body}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:col-span-2">
            <h3 className="text-[14px] font-semibold">How the scan works</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">
              The app takes roughly 500 candles, measures ATR(14), then marks every swing high and
              swing low — a candle whose wick is the extreme of five candles on each side. Swings
              that sit within half an ATR of each other are grouped into one zone, padded by a tenth
              of an ATR. Each zone is scored on touches, recency and whether it also appears one
              timeframe up. Zones with one touch are discarded, and so are zones the price has broken
              twice. No AI, no prediction: just geometry on candles.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
