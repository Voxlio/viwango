'use client';

import { useEffect, useState } from 'react';

/**
 * Stable, always-visible top bar.
 *
 * It stays pinned while the page scrolls (that is the "header showing" ask) and
 * carries one nav button that jumps back to the search. The bar gains a solid
 * backdrop once you scroll, so the wordmark never floats over moving text.
 */
export function Header({ onFindLevels }: { onFindLevels: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled ? 'border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#top" className="focus-ring flex items-center gap-2.5 rounded-lg" aria-label="VIWANGO home">
          {/* CSS-only mark: three stacked bars, echoing the reference logo. */}
          <span className="flex h-7 w-7 flex-col justify-center gap-[3px]" aria-hidden="true">
            <span className="ml-auto block h-[5px] w-[13px] rounded-[1px] bg-white" />
            <span className="block h-[5px] w-[18px] rounded-[1px] bg-white" />
            <span className="ml-auto block h-[5px] w-[9px] rounded-[1px] bg-white/55" />
          </span>
          <span className="font-display text-[19px] font-semibold tracking-[-0.02em]">viwango</span>
        </a>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-pill border border-white/10 px-3 py-1.5 text-[12px] text-white/55 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-floor" />
            No AI · plain maths
          </span>

          <button
            type="button"
            onClick={onFindLevels}
            className="focus-ring inline-flex items-center gap-1.5 rounded-pill bg-white px-4 py-2 text-[13px] font-semibold text-ink-950 transition-transform active:scale-[0.97]"
          >
            Find levels
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Mobile-only nav: a small sheet with the page's anchor links. */}
          <div className="relative sm:hidden">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] text-white/80"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={menuOpen ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h10'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {menuOpen && (
              <nav
                className="absolute right-0 top-11 w-48 animate-rise overflow-hidden rounded-2xl border border-white/10 bg-ink-850/95 p-1.5 text-sm shadow-glass backdrop-blur-xl"
                aria-label="Page sections"
              >
                {[
                  ['Summary', '#summary'],
                  ['Chart', '#chart'],
                  ['Zones', '#zones'],
                  ['How to read this', '#guide'],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
