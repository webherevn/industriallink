/**
 * Cổng CTV (ctv.inlink.vn) có topbar riêng, không dùng AppShell/RecruiterShell.
 * Vì vậy loading riêng: topbar + 2 cột (giới thiệu | form đăng nhập).
 */
export default function CtvLoading() {
  return (
    <div className="min-h-screen bg-[#F5F7FB]" aria-busy="true" aria-live="polite">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200/80" />
            <div className="hidden h-6 w-44 animate-pulse rounded-full bg-amber-100 sm:block" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200/80" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-start">
          <div className="space-y-4">
            <div className="brand-hero-surface rounded-2xl p-6 sm:p-8">
              <div className="space-y-3">
                <div className="h-5 w-40 animate-pulse rounded-full bg-white/20" />
                <div className="h-7 w-3/4 animate-pulse rounded-lg bg-white/25" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/15" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-4"
                >
                  <div className="h-5 w-5 rounded bg-slate-200/80" />
                  <div className="mt-2 h-3.5 w-2/3 rounded bg-slate-200/80" />
                  <div className="mt-1.5 h-2.5 w-full rounded bg-slate-200/60" />
                </div>
              ))}
            </div>
          </div>
          <div className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="h-9 w-full rounded-xl bg-slate-200/70" />
            <div className="mt-4 space-y-3.5">
              <div className="h-10 w-full rounded-lg bg-slate-200/70" />
              <div className="h-10 w-full rounded-lg bg-slate-200/70" />
              <div className="h-10 w-full rounded-lg bg-brand-100" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
