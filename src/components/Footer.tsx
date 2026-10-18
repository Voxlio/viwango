/**
 * Footer. The disclaimer is deliberately plain and always visible: this app
 * shows zones where price has turned before, which is evidence, not a promise.
 */
export function AppFooter() {
  return (
    <footer className="mt-14 border-t border-white/[0.07] py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 sm:px-6">
        <p className="text-[12px] leading-relaxed text-white/40">
          Educational use only. Levels are zones, not guarantees. Not financial advice.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/25">
          <span>VIWANGO · floors and ceilings from plain candle maths · no AI, no signals</span>
          <a href="#top" className="focus-ring rounded-md transition-colors hover:text-white/50">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
