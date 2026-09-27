'use client';

import type { CmsCrawlReport } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { AdminIndexingPanel } from '@/components/admin-indexing-panel';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui';
import { fetchCmsCrawl } from '@/lib/admin-cms';

function quotaTone(report: CmsCrawlReport): string {
  const used = report.indexing.quotaUsed;
  const limit = report.indexing.quotaLimit;
  if (report.indexing.http403 > 0 || report.indexing.http429 > 0 || used >= limit) return 'bg-red-500';
  if (used >= limit * 0.8) return 'bg-[#E8872A]';
  return 'bg-[#072348]';
}

export default function AdminSeoCrawlPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-cms-crawl'],
    queryFn: fetchCmsCrawl,
    refetchOnWindowFocus: true,
  });

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Indexing & crawl
            </p>
            <h1 className="cms-page-title mt-1.5">Crawl & index</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Quota Indexing API, sitemap, trang không có internal link, và chuỗi redirect.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/seo"
              className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              SEO overview
            </Link>
            <Link
              href="/admin/seo/trust"
              className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              E-E-A-T
            </Link>
            <Button type="button" variant="ghost" className="gap-1.5 shadow-sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="admin-dash-skel h-40" />
        ) : isError || !data ? (
          <p className="rounded-[1.15rem] border border-dashed border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Không tải được báo cáo crawl.'}
          </p>
        ) : (
          <>
            <section className="admin-dash-card p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Google Indexing API</h2>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                        data.indexing.configured && data.indexing.autoNotify
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200',
                      )}
                    >
                      {!data.indexing.configured ? 'Chưa kết nối' : data.indexing.autoNotify ? 'Tự gửi: bật' : 'Tự gửi: tắt'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Request URL_UPDATED và URL_DELETED trong ngày (giờ Việt Nam). Hạn mức mặc định {data.indexing.quotaLimit}/ngày.
                  </p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-[#072348]">
                  {data.indexing.quotaUsed}
                  <span className="text-base font-semibold text-slate-400">/{data.indexing.quotaLimit}</span>
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx('admin-dash-bar h-full rounded-full', quotaTone(data))}
                  style={{ width: `${Math.min(100, Math.round((data.indexing.quotaUsed / data.indexing.quotaLimit) * 100))}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ['Updated', data.indexing.todayUpdated],
                  ['Deleted', data.indexing.todayDeleted],
                  ['Lỗi', data.indexing.todayErrors],
                  ['403 / 429', `${data.indexing.http403} / ${data.indexing.http429}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-[#f8fafc] px-4 py-3 ring-1 ring-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#072348]">{value}</p>
                  </div>
                ))}
              </div>
              {data.indexing.alerts.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {data.indexing.alerts.map((alert) => (
                    <li key={alert} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                      {alert}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.indexing.recent.length > 0 ? (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.indexing.recent.map((row) => (
                    <li key={`${row.createdAt}-${row.url}`} className="flex flex-wrap items-baseline gap-2 py-2 text-xs">
                      <span className={clsx('rounded px-1.5 py-0.5 font-bold', row.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                        {row.ok ? row.type : row.statusCode ?? 'lỗi'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[#072348]">{row.url}</span>
                      <span className="text-slate-400">{new Date(row.createdAt).toLocaleString('vi-VN')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Chưa có request nào được ghi lại.</p>
              )}
            </section>

            <AdminIndexingPanel />

            <section className="grid gap-3 sm:grid-cols-2">
              {data.sitemaps.map((map) => (
                <article key={map.id} className="admin-dash-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#072348]">{map.label}</h3>
                      <a href={map.href} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-accent-600">
                        {map.href.replace(/^https?:\/\/[^/]+/, '')}
                      </a>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[#072348]">{map.urlCount}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Noindex đã loại {map.excludedNoindex} · Trùng redirect {map.redirectConflicts}
                  </p>
                  {map.warnings.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {map.warnings.map((warning) => (
                        <li key={warning} className="text-xs font-medium text-amber-800">{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-emerald-700">Không thấy URL noindex hoặc redirect trong file này.</p>
                  )}
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <article className="admin-dash-card p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900">Trang mồ côi</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Trang không có link nội bộ. Bài có chuyên mục hoặc nằm trong 24 bài đầu của /cam-nang không tính.
                  Tin tuyển dụng được liệt kê tại /viec-lam.
                </p>
                {data.orphans.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Không có trang mồ côi trong phạm vi đã quét.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.orphans.map((item) => (
                      <li key={item.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[#f8fafc] px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 ring-1 ring-slate-200">
                            {item.kind === 'page' ? 'Trang' : 'Bài viết'}
                          </span>
                          <Link href={item.editPath} className="font-semibold text-[#072348] hover:text-accent-600">
                            {item.title}
                          </Link>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.publicPath} — {item.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="admin-dash-card p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900">Chuỗi & vòng redirect</h2>
                <p className="mt-0.5 text-xs text-slate-500">A → B → C, hoặc vòng A → B → A.</p>
                {data.redirectIssues.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Không có chuỗi hoặc vòng lặp.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data.redirectIssues.map((issue) => (
                      <li key={issue.hops.join('>')} className="rounded-xl bg-[#f8fafc] px-3 py-2 text-xs">
                        <span className={clsx('mr-2 font-bold', issue.kind === 'loop' ? 'text-red-700' : 'text-amber-800')}>
                          {issue.kind === 'loop' ? 'Vòng lặp' : 'Chuỗi'}
                        </span>
                        <span className="text-[#072348]">{issue.hops.join(' → ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
