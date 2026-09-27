'use client';

import type { CwvRating, CwvReport, CwvRow, CwvStrategy, CwvTestResult, CwvValue } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Gauge,
  KeyRound,
  Loader2,
  Monitor,
  Play,
  RefreshCw,
  Smartphone,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchCwvReport, fetchCwvSettings, startCwvScan, testCwvKey, updateCwvSettings } from '@/lib/admin-vitals';

type Filter = 'all' | 'inp' | 'risk' | 'lcp' | 'unscanned';

const KIND_LABEL: Record<CwvRow['kind'], string> = {
  home: 'Trang chủ',
  hub: 'Hub',
  category: 'Danh mục',
  post: 'Bài viết',
  page: 'Trang',
  visited: 'Có lượt xem',
};

const RATING_TEXT: Record<CwvRating, string> = {
  good: 'text-emerald-700',
  'needs-improvement': 'text-amber-700',
  poor: 'text-red-700',
};

const RATING_DOT: Record<CwvRating, string> = {
  good: 'bg-emerald-500',
  'needs-improvement': 'bg-amber-500',
  poor: 'bg-red-500',
};

function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

function metricText(metric: 'LCP' | 'INP' | 'CLS', v: CwvValue): string {
  return metric === 'CLS' ? v.value.toFixed(2) : ms(v.value);
}

function sourceLabel(v: CwvValue): string {
  if (v.source === 'crux-url') return 'CrUX';
  if (v.source === 'crux-origin') return 'CrUX domain';
  if (v.source === 'rum') return `Đo thật · ${v.samples ?? 0} mẫu`;
  return 'Lab';
}

function time(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminSeoVitalsPage() {
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState<CwvStrategy>('mobile');
  const [filter, setFilter] = useState<Filter>('all');
  const [customPath, setCustomPath] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-cwv', strategy],
    queryFn: () => fetchCwvReport(strategy),
    refetchInterval: (query) => (query.state.data?.job.running ? 3000 : false),
    refetchOnWindowFocus: true,
  });

  const running = Boolean(data?.job.running);
  const [wasRunning, setWasRunning] = useState(false);
  useEffect(() => {
    if (running) setWasRunning(true);
    else if (wasRunning && data) {
      setWasRunning(false);
      setNotice({
        tone: data.job.failed > 0 ? 'err' : 'ok',
        text: `Đã quét xong ${data.job.done} URL (${data.job.strategy === 'mobile' ? 'mobile' : 'desktop'})${data.job.failed > 0 ? `, ${data.job.failed} URL lỗi` : ''}.`,
      });
    }
  }, [running, wasRunning, data]);

  const scan = useMutation({
    mutationFn: (paths?: string[]) => startCwvScan({ strategy, paths }),
    onSuccess: async (job) => {
      setNotice({ tone: 'ok', text: `Đang quét ${job.total} URL bằng PageSpeed Insights. Mỗi URL mất khoảng 15–40 giây.` });
      await qc.invalidateQueries({ queryKey: ['admin-cwv', strategy] });
    },
    onError: (err) => setNotice({ tone: 'err', text: err instanceof ApiError ? err.message : 'Không bắt đầu quét được.' }),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === 'inp') return data.rows.filter((row) => row.inpSlow);
    if (filter === 'risk') return data.rows.filter((row) => row.inpRisk);
    if (filter === 'lcp') return data.rows.filter((row) => row.lcpSlow);
    if (filter === 'unscanned') return data.rows.filter((row) => !row.scan);
    return data.rows;
  }, [data, filter]);

  const customValid = /^\/(?![/\\])[^\s?#]*$/.test(customPath.trim());

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">Performance</p>
            <h1 className="cms-page-title mt-1.5">Core Web Vitals</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2 max-w-2xl">
              INP, LCP và CLS theo từng URL. Cảnh báo URL có INP trên 200 ms (phản hồi tương tác chậm) và LCP trên 2,5 giây.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/seo"
              className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              SEO overview
            </Link>
            <div className="flex h-10 items-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {(
                [
                  ['mobile', 'Mobile', Smartphone],
                  ['desktop', 'Desktop', Monitor],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={clsx(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition',
                    strategy === id ? 'bg-[#072348] text-white' : 'text-slate-500 hover:text-[#072348]',
                  )}
                  onClick={() => setStrategy(id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={running || scan.isPending || !data?.hasKey || !data?.siteUrl}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#E8872A] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#D06F18] disabled:opacity-40"
              onClick={() => scan.mutate(undefined)}
            >
              {running || scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Đang quét…' : 'Quét PageSpeed'}
            </button>
            <Button type="button" variant="ghost" className="gap-1.5 shadow-sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            className={clsx(
              'flex items-start justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm',
              notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            <div className="admin-dash-skel h-40" />
            <div className="admin-dash-skel h-64" />
          </div>
        ) : isError || !data ? (
          <p className="rounded-[1.15rem] border border-dashed border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Không tải được Core Web Vitals.'}
          </p>
        ) : (
          <>
            {!data.hasKey || !data.siteUrl ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {!data.hasKey
                    ? 'Chưa lưu khóa PageSpeed Insights. Dán khóa ở mục «Khóa PageSpeed Insights» cuối trang.'
                    : 'Chưa có domain công khai để PageSpeed tải trang (localhost không đo được). Nhập domain, ví dụ https://inlink.vn, ở cuối trang.'}{' '}
                  Số liệu đo thật trên inlink vẫn được ghi.
                </span>
              </div>
            ) : null}

            <Hero data={data} />

            {running ? <JobProgress data={data} /> : null}

            <AlertPanel data={data} />

            <section className="admin-dash-card admin-dash-rise p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Theo từng URL · {strategy === 'mobile' ? 'Mobile' : 'Desktop'}</h2>
                  <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                    INP ưu tiên CrUX của URL, rồi số đo thật trên inlink ({data.rumDays} ngày, p75). LCP và CLS lùi về Lighthouse khi chưa có dữ liệu thật. TBT là chỉ số lab gần nhất với INP.
                  </p>
                </div>
                <div className="flex flex-wrap rounded-xl bg-[#f8fafc] p-1 ring-1 ring-slate-200">
                  {(
                    [
                      ['all', `Tất cả · ${data.rows.length}`],
                      ['inp', `INP > 200ms · ${data.summary.inpSlow}`],
                      ['risk', `Nguy cơ INP · ${data.summary.inpRisk}`],
                      ['lcp', `LCP chậm · ${data.summary.lcpSlow}`],
                      ['unscanned', 'Chưa quét'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                        filter === id ? 'bg-[#072348] text-white' : 'text-slate-500 hover:text-[#072348]',
                      )}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <form
                className="mt-4 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!customValid) return;
                  scan.mutate([customPath.trim()]);
                  setCustomPath('');
                }}
              >
                <input
                  className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFF8F1]"
                  placeholder="/viec-lam/ten-tin-tuyen-dung"
                  value={customPath}
                  onChange={(event) => setCustomPath(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={!customValid || running || scan.isPending || !data.hasKey || !data.siteUrl}
                  className="h-9 rounded-xl bg-[#072348] px-3 text-xs font-semibold text-white transition hover:bg-[#0c3a72] disabled:opacity-40"
                >
                  Đo URL khác
                </button>
              </form>

              {rows.length === 0 ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Không có URL nào trong bộ lọc này.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3">Trang</th>
                        <th className="px-3 py-2">INP</th>
                        <th className="px-3 py-2">LCP</th>
                        <th className="px-3 py-2">CLS</th>
                        <th className="px-3 py-2">TBT (lab)</th>
                        <th className="px-3 py-2">Điểm</th>
                        <th className="py-2 pl-3 text-right">PageSpeed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <UrlRow
                          key={row.path}
                          row={row}
                          disabled={running || scan.isPending || !data.hasKey || !data.siteUrl}
                          onScan={() => scan.mutate([row.path])}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-400">Cập nhật {time(data.generatedAt)}</p>
            </section>

            <Legend />
          </>
        )}

        <SettingsCard />
      </div>
    </AdminShell>
  );
}

function Hero({ data }: { data: CwvReport }) {
  const stats = [
    { label: 'Nguy cơ INP (TBT > 200ms)', value: data.summary.inpRisk, tone: 'text-amber-200' },
    { label: 'LCP > 2,5 s', value: data.summary.lcpSlow, tone: 'text-rose-200' },
    { label: 'CLS > 0,1', value: data.summary.clsPoor, tone: 'text-amber-200' },
    { label: `Mẫu đo thật · ${data.rumDays} ngày`, value: data.rumSamples, tone: 'text-sky-200' },
  ];
  return (
    <div className="admin-dash-hero admin-dash-rise p-5 sm:p-7">
      <span className="admin-dash-glow -right-10 -top-12 h-44 w-44 bg-accent-500/45" aria-hidden />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div
            className={clsx(
              'flex h-[96px] w-[96px] shrink-0 flex-col items-center justify-center rounded-full border-[6px]',
              data.summary.inpSlow > 0 ? 'border-rose-400/80' : 'border-emerald-400/80',
            )}
          >
            <span className="text-3xl font-bold leading-none">{data.summary.inpSlow}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/65">URL</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-300">INP &gt; 200 ms</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {data.summary.inpSlow > 0 ? 'Có URL phản hồi tương tác chậm' : 'Chưa thấy URL INP chậm'}
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-300">
              Theo dữ liệu thật: CrUX của Google hoặc đo trên trình duyệt khách inlink, cần ít nhất 5 mẫu mỗi URL.
            </p>
            <OriginLine data={data} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-center backdrop-blur-sm">
              <p className={clsx('text-2xl font-bold tabular-nums', s.tone)}>{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OriginLine({ data }: { data: CwvReport }) {
  const host = data.siteUrl?.replace(/^https?:\/\//, '') ?? 'domain';
  if (!data.origin) {
    return (
      <p className="mt-2 text-[11px] text-white/55">
        CrUX cả domain: Google chưa đủ lượt truy cập thật của {host} để công bố INP. Khi có, số liệu hiện ở đây sau lần quét tới.
      </p>
    );
  }
  const items = [
    ['INP', data.origin.inp],
    ['LCP', data.origin.lcp],
    ['CLS', data.origin.cls],
  ] as const;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/70">
      <span>CrUX {host}:</span>
      {items.map(([name, v]) =>
        v ? (
          <span key={name} className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white">
            {name} {metricText(name, v)}
          </span>
        ) : null,
      )}
      {data.originCheckedAt ? <span className="text-white/45">· {time(data.originCheckedAt)}</span> : null}
    </div>
  );
}

function JobProgress({ data }: { data: CwvReport }) {
  const percent = data.job.total ? Math.round((data.job.done / data.job.total) * 100) : 0;
  return (
    <section className="admin-dash-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-[#072348]">
          <Loader2 className="h-4 w-4 animate-spin text-accent-600" />
          Đang quét PageSpeed · {data.job.strategy === 'mobile' ? 'Mobile' : 'Desktop'}
        </span>
        <span className="tabular-nums text-slate-500">
          {data.job.done}/{data.job.total}
          {data.job.failed > 0 ? ` · ${data.job.failed} lỗi` : ''}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#E8872A] transition-all" style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      {data.job.current ? <p className="mt-1.5 truncate text-xs text-slate-400">Đang đo {data.job.current}</p> : null}
    </section>
  );
}

function AlertPanel({ data }: { data: CwvReport }) {
  const slow = data.rows.filter((row) => row.inpSlow);
  const risk = data.rows.filter((row) => row.inpRisk);
  return (
    <section className="admin-dash-card admin-dash-rise p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Cảnh báo INP &gt; 200 ms</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            INP (Interaction to Next Paint) là độ trễ từ lúc khách bấm, gõ hoặc chạm tới khi trang vẽ phản hồi. Google coi trên 200 ms là cần cải thiện, trên 500 ms là kém.
          </p>
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1',
            slow.length > 0 ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
          )}
        >
          {slow.length}
        </span>
      </div>

      {slow.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Chưa có URL nào INP trên 200 ms theo dữ liệu thật.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {slow.map((row) => (
            <li key={row.path} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2.5">
              <span className="text-lg font-bold tabular-nums text-red-700">{row.inp ? ms(row.inp.value) : '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#072348]">{row.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {row.path} · {row.inp ? sourceLabel(row.inp) : ''}
                </p>
              </div>
              <RowLinks row={row} />
            </li>
          ))}
        </ul>
      )}

      {risk.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Nguy cơ INP chậm · chưa có dữ liệu thật, lab TBT &gt; 200 ms
          </p>
          <ul className="mt-2 space-y-2">
            {risk.map((row) => (
              <li key={row.path} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                <span className="text-sm font-bold tabular-nums text-amber-800">TBT {ms(row.scan?.labTbtMs ?? 0)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#072348]">{row.title}</p>
                  <p className="truncate text-xs text-slate-500">{row.path}</p>
                </div>
                <RowLinks row={row} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RowLinks({ row }: { row: CwvRow }) {
  return (
    <div className="flex shrink-0 items-center gap-3 text-xs font-semibold">
      {row.editPath ? (
        <Link href={row.editPath} className="text-[#072348] hover:text-accent-600">
          Sửa
        </Link>
      ) : null}
      {/^https?:\/\//.test(row.url) ? (
        <a
          href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(row.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#E8872A] hover:text-[#D06F18]"
        >
          PageSpeed <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function MetricCell({ metric, v }: { metric: 'LCP' | 'INP' | 'CLS'; v: CwvValue | null }) {
  if (!v) return <td className="px-3 py-3 text-xs text-slate-300">—</td>;
  return (
    <td className="px-3 py-3">
      <span className={clsx('inline-flex items-center gap-1.5 font-bold tabular-nums', RATING_TEXT[v.rating])}>
        <span className={clsx('h-2 w-2 rounded-full', RATING_DOT[v.rating])} />
        {metricText(metric, v)}
      </span>
      <p className="mt-0.5 text-[10px] font-medium text-slate-400">{sourceLabel(v)}</p>
    </td>
  );
}

function UrlRow({ row, disabled, onScan }: { row: CwvRow; disabled: boolean; onScan: () => void }) {
  const tbt = row.scan?.labTbtMs;
  const perf = row.scan?.performance;
  return (
    <tr className={clsx('align-top', row.inpSlow && 'bg-red-50/40')}>
      <td className="max-w-[320px] py-3 pr-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
            {KIND_LABEL[row.kind]}
          </span>
          {row.editPath ? (
            <Link href={row.editPath} className="truncate font-semibold text-[#072348] hover:text-accent-600">
              {row.title}
            </Link>
          ) : (
            <span className="truncate font-semibold text-[#072348]">{row.title}</span>
          )}
        </div>
        {/^https?:\/\//.test(row.url) ? (
          <a href={row.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-xs text-slate-500 hover:text-accent-600">
            {row.path}
          </a>
        ) : (
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.path}</p>
        )}
        {row.scan?.error ? <p className="mt-1 line-clamp-2 text-[11px] text-red-600">{row.scan.error}</p> : null}
      </td>
      <MetricCell metric="INP" v={row.inp} />
      <MetricCell metric="LCP" v={row.lcp} />
      <MetricCell metric="CLS" v={row.cls} />
      <td className="px-3 py-3">
        {typeof tbt === 'number' ? (
          <span className={clsx('font-bold tabular-nums', tbt > 600 ? 'text-red-700' : tbt > 200 ? 'text-amber-700' : 'text-emerald-700')}>
            {ms(tbt)}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {typeof perf === 'number' ? (
          <span
            className={clsx(
              'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2',
              perf >= 90 ? 'text-emerald-700 ring-emerald-300' : perf >= 50 ? 'text-amber-700 ring-amber-300' : 'text-red-700 ring-red-300',
            )}
          >
            {perf}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="py-3 pl-3 text-right">
        <button
          type="button"
          disabled={disabled}
          onClick={onScan}
          className="h-7 rounded-lg px-2.5 text-xs font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3] disabled:opacity-40"
        >
          {row.scan ? 'Đo lại' : 'Đo'}
        </button>
        <p className="mt-1 text-[10px] text-slate-400">{row.scan ? time(row.scan.scannedAt) : 'Chưa quét'}</p>
      </td>
    </tr>
  );
}

function Legend() {
  const items = [
    ['INP', 'Tốt ≤ 200 ms · kém > 500 ms', 'Chỉ có trong dữ liệu thật. Lab không đo được INP.'],
    ['LCP', 'Tốt ≤ 2,5 s · kém > 4 s', 'Thời gian hiện khối nội dung lớn nhất.'],
    ['CLS', 'Tốt ≤ 0,1 · kém > 0,25', 'Độ xê dịch bố cục khi tải.'],
    ['TBT', 'Tốt ≤ 200 ms · kém > 600 ms', 'Lighthouse: thời gian luồng chính bị chặn, gần với INP.'],
  ];
  return (
    <section className="admin-dash-card p-5 sm:p-6">
      <h2 className="text-sm font-bold text-slate-900">Ngưỡng & nguồn số liệu</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([name, threshold, hint]) => (
          <div key={name} className="rounded-2xl bg-[#f8fafc] px-4 py-3 ring-1 ring-slate-100">
            <p className="text-sm font-bold text-[#072348]">{name}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">{threshold}</p>
            <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <li>
          <b className="text-[#072348]">CrUX:</b> dữ liệu người dùng Chrome 28 ngày Google công bố qua PageSpeed, chỉ có khi URL đủ lượt truy cập.
        </li>
        <li>
          <b className="text-[#072348]">Đo thật:</b> inlink tự ghi từ trình duyệt khách (p75, {28} ngày), tách mobile và desktop.
        </li>
        <li>
          <b className="text-[#072348]">Lab:</b> Lighthouse chạy một lần từ máy chủ Google, dùng khi chưa có dữ liệu thật.
        </li>
        <li>
          <b className="text-[#072348]">Tự quét:</b> mỗi ngày 2:30 sáng quét lại danh sách trên mobile nếu bật trong cài đặt.
        </li>
      </ul>
    </section>
  );
}

function SettingsCard() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ['admin-cwv-settings'], queryFn: fetchCwvSettings, retry: false });
  const [apiKey, setApiKey] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [autoScan, setAutoScan] = useState(true);
  const [clearKey, setClearKey] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [test, setTest] = useState<CwvTestResult | null>(null);

  useEffect(() => {
    if (!data) return;
    setSiteUrl(data.siteUrl ?? '');
    setAutoScan(data.autoScan);
    setApiKey('');
    setClearKey(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateCwvSettings({
        apiKey: clearKey ? null : apiKey.trim() || undefined,
        siteUrl: siteUrl.trim() || null,
        autoScan,
      }),
    onSuccess: async (view) => {
      qc.setQueryData(['admin-cwv-settings'], view);
      setBanner({ tone: 'ok', text: 'Đã lưu cài đặt PageSpeed.' });
      setTest(null);
      await qc.invalidateQueries({ queryKey: ['admin-cwv'] });
    },
    onError: (err) => setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại.' }),
  });

  const runTest = useMutation({
    mutationFn: testCwvKey,
    onSuccess: (res) => setTest(res),
    onError: (err) => setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Test thất bại.' }),
  });

  if (isError || !data) return null;

  return (
    <section className="admin-dash-card border-[#FFD0A3] bg-gradient-to-b from-[#FFF8F1] to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-600 ring-1 ring-[#FFD0A3]">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#072348]">Khóa PageSpeed Insights</h2>
            <p className="mt-0.5 text-xs font-medium text-accent-700">Chỉ dùng cho trang Core Web Vitals · lưu mã hoá trong database</p>
          </div>
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
            data.hasKey ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}
        >
          {data.hasKey ? `Đã có khóa ${data.keyPreview ?? ''}` : 'Chưa có khóa'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">API key PageSpeed Insights</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {data.hasKey ? 'Để trống khi Lưu = giữ khóa hiện tại.' : 'Tạo tại Google Cloud Console, bật PageSpeed Insights API.'}
          </span>
          <input
            type="password"
            autoComplete="off"
            disabled={clearKey}
            value={clearKey ? '' : apiKey}
            placeholder={data.hasKey ? '•••••••• giữ khóa đã lưu' : 'Dán API key'}
            onChange={(event) => setApiKey(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFF8F1] disabled:bg-slate-50"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Domain công khai để đo</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            PageSpeed tải trang từ máy chủ Google nên cần domain thật.
            {data.defaultSiteUrl ? ` Để trống = ${data.defaultSiteUrl}.` : ' Máy này đang chạy localhost nên phải nhập.'}
          </span>
          <input
            value={siteUrl}
            placeholder={data.defaultSiteUrl ?? 'https://inlink.vn'}
            onChange={(event) => setSiteUrl(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFF8F1]"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} />
          Tự quét mobile mỗi ngày lúc 2:30 sáng
        </label>
        {data.hasKey ? (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={clearKey} onChange={(event) => setClearKey(event.target.checked)} />
            Xoá khóa đã lưu
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="!rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lưu cài đặt
        </Button>
        <Button variant="outline" onClick={() => runTest.mutate()} disabled={runTest.isPending || !data.hasKey}>
          {runTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {runTest.isPending ? 'Đang đo trang chủ…' : 'Test khóa PageSpeed'}
        </Button>
        <span className="text-xs text-slate-400">Test đo trang chủ trên mobile, mất khoảng 15–30 giây.</span>
      </div>

      {banner ? (
        <p
          className={clsx(
            'mt-4 rounded-2xl border px-3 py-2 text-sm',
            banner.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {banner.text}
        </p>
      ) : null}
      {test ? (
        <div
          className={clsx(
            'mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-sm',
            test.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            <b>{test.url || 'PageSpeed'}</b> · {test.latencyMs} ms
            {typeof test.performance === 'number' ? ` · điểm ${test.performance}` : ''} — {test.message}
          </span>
        </div>
      ) : null}
    </section>
  );
}
