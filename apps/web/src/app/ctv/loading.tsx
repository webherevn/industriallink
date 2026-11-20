/**
 * Skeleton của Cổng CTV: Sidebar trái + khối nội dung.
 */
export default function CtvLoading() {
  return (
    <div className="flex min-h-screen bg-slate-50" aria-busy="true" aria-live="polite">
      <div className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="space-y-2 px-4 py-5">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200/60" />
        </div>
        <div className="space-y-2 px-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-9 animate-pulse rounded-lg bg-slate-100"
              style={{ animationDelay: `${index * 60}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200/80" />
        </div>
        <main className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200/50" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200/50" />
          </div>
        </main>
      </div>
    </div>
  );
}
