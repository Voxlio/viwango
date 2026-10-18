'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SYMBOLS, searchSymbols, type SymbolConfig } from '@/lib/symbols';

/**
 * Symbol search with autocomplete over the curated list.
 *
 * Keyboard support matters here: arrow keys move, Enter selects, Escape closes.
 * The input is a combobox so screen readers announce the suggestion list.
 */
export function SearchBox({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (symbol: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close when focus leaves the whole widget, not just the input.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const suggestions = useMemo(() => {
    const results = searchSymbols(query);
    // Always offer something to pick when the query matches nothing exactly.
    return results.length > 0 ? results : SYMBOLS.slice(0, 4);
  }, [query]);

  const commit = (symbol: string) => {
    onChange(symbol);
    setQuery(symbol);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      // Enter picks the highlighted suggestion while the list is open, and
      // otherwise submits the search — the behaviour people already expect.
      if (open && suggestions[activeIndex]) {
        event.preventDefault();
        commit(suggestions[activeIndex].symbol);
        onSubmit();
      } else {
        event.preventDefault();
        const typed = query.trim().toUpperCase();
        const exact = SYMBOLS.find((s) => s.symbol === typed);
        if (exact) onChange(exact.symbol);
        onSubmit();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-pill border border-white/[0.12] bg-white/[0.045] pl-4 pr-1.5 py-1.5 transition-colors focus-within:border-white/30">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/40" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          aria-label="Search for an asset"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
          placeholder="Search an asset — gold, BTC, AAPL…"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setActiveIndex(0);
            // A typed ticker that exactly matches a configured symbol is
            // applied immediately, so "XAUUSD" works without touching the list.
            const exact = SYMBOLS.find((s) => s.symbol === next.trim().toUpperCase());
            if (exact) onChange(exact.symbol);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setOpen(true);
            }}
            className="focus-ring rounded-full p-1.5 text-white/35 hover:text-white/70"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="focus-ring shrink-0 rounded-pill bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 sm:px-5"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Finding…
            </span>
          ) : (
            'Find levels'
          )}
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Asset suggestions"
          className="thin-scroll absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 animate-rise overflow-y-auto rounded-2xl border border-white/10 bg-ink-850/95 p-1.5 shadow-glass backdrop-blur-xl"
        >
          {suggestions.map((symbol, index) => (
            <li key={symbol.symbol} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  commit(symbol.symbol);
                  onSubmit();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                  index === activeIndex ? 'bg-white/[0.07]' : ''
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className={`pill-dot ${dotColor(symbol)}`} />
                  <span className="text-sm font-semibold tracking-wide">{symbol.symbol}</span>
                  <span className="truncate text-[12px] text-white/45">{symbol.name}</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">{symbol.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dotColor(symbol: SymbolConfig): string {
  switch (symbol.kind) {
    case 'metal':
      return 'bg-amber';
    case 'forex':
      return 'bg-sky-400';
    case 'crypto':
      return 'bg-floor';
    default:
      return 'bg-violet-400';
  }
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
