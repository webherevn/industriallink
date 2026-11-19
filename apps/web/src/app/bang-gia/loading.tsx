/**
 * Bảng giá là trang marketing công khai, tự có header riêng (PricingClient).
 * Loading riêng để lúc điều hướng không trắng rồi mới dựng.
 */
export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-[#F5F7FB]" aria-busy="true" aria-live="polite">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200/80" />
          <nav className="hidden items-center gap-6 lg:flex">
            {[110, 120, 96, 110, 84].map((w, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded bg-slate-200/70" style={{ width: w }} />
            ))}
          </nav>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200/80" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="mx-auto h-4 w-96 max-w-full animate-pulse rounded bg-slate-200/60" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
            >
              <div className="h-5 w-24 rounded bg-slate-200/80" />
              <div className="mt-3 h-8 w-32 rounded bg-slate-200/70" />
              <div className="mt-5 space-y-2">
                {[100, 88, 94, 76].map((w, j) => (
                  <div key={j} className="h-2.5 rounded bg-slate-200/60" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-slate-200/70" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
