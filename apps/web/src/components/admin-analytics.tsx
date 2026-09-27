'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsRealtime,
  fetchAnalyticsSession,
  fetchAnalyticsSessions,
  type AnalyticsPeriod,
  type AnalyticsRange,
} from '@/lib/admin-analytics';

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
];

const DEVICE_LABEL: Record<string, string> = {
  desktop: 'Máy tính',
  mobile: 'Điện thoại',
  tablet: 'Máy tính bảng',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec} giây`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `${min} phút ${rem} giây` : `${min} phút`;
  const hours = Math.floor(min / 60);
  return `${hours} giờ ${min % 60} phút`;
}

function Delta({
  current,
  previous,
  invert = false,
  suffix = '%',
}: {
  current: number;
  previous: number;
  invert?: boolean;
  suffix?: string;
}) {
  if (previous === 0) {
    return (
      <span className="text-[11px] font-medium text-slate-400">
        {current === 0 ? 'Không đổi so với kỳ trước' : 'Chưa có số kỳ trước để so'}
      </span>
    );
  }
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const value = Math.round(raw * 10) / 10;
  if (Math.abs(value) < 0.1) {
    return <span className="text-[11px] font-medium text-slate-400">Không đổi so với kỳ trước</span>;
  }
  const up = value > 0;
  const good = invert ? !up : up;
  return (
    <span className={clsx('text-[11px] font-semibold', good ? 'text-emerald-600' : 'text-rose-600')}>
      {up ? '↑' : '↓'} {Math.abs(value)}
      {suffix} so với kỳ trước
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="admin-dash-card !p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-[1.65rem] font-bold leading-none tracking-tight text-[#072348]">{value}</p>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </Card>
  );
}

function ShareList({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: number; detail?: string }>;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-[#072348]">{row.label}</span>
            <span className="shrink-0 text-slate-500">
              <span className="font-semibold text-[#072348]">{row.value}</span>
              {row.detail ? <span className="text-slate-400"> · {row.detail}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="admin-dash-bar h-full rounded-full bg-[#E8872A]"
              style={{ width: `${Math.max(6, Math.round((row.value / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="admin-dash-card !p-5">
      <p className="text-sm font-semibold text-[#072348]">{title}</p>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function AdminAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ['admin-analytics', range],
    queryFn: () => fetchAnalyticsOverview(range),
    refetchInterval: 30_000,
  });
  const realtime = useQuery({
    queryKey: ['admin-analytics-live'],
    queryFn: fetchAnalyticsRealtime,
    refetchInterval: 5_000,
  });
  const sessions = useQuery({
    queryKey: ['admin-analytics-sessions', page, q],
    queryFn: () => fetchAnalyticsSessions(page, q),
    refetchInterval: 15_000,
  });
  const detail = useQuery({
    queryKey: ['admin-analytics-session', openId],
    queryFn: () => fetchAnalyticsSession(openId as string),
    enabled: Boolean(openId),
  });

  const error = overview.error || realtime.error || sessions.error;
  const denied = error instanceof ApiError && error.status === 403;
  const stats = overview.data;
  const previous: AnalyticsPeriod | undefined = stats?.previous;
  const series = stats?.series ?? [];
  const peak = Math.max(1, ...series.map((point) => Math.max(point.pageviews, point.visitors)));
  const totalPages = sessions.data ? Math.max(1, Math.ceil(sessions.data.total / sessions.data.limit)) : 1;
  const audience = (stats?.newVisitors ?? 0) + (stats?.returningVisitors ?? 0);
  const deviceTotal = (stats?.devices ?? []).reduce((sum, row) => sum + row.sessions, 0);

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">Tổng quan</p>
            <h1 className="cms-page-title mt-1.5">Analytics</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2 max-w-2xl">
              Hành vi người dùng trên website. IP chỉ hiện khi mở chi tiết phiên.
            </p>
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx(
                  'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
                  range === item.id ? 'bg-[#072348] text-white' : 'text-slate-500 hover:text-[#072348]',
                )}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {denied ? (
          <p className="rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-10 text-center text-sm text-slate-500">
            Chỉ SuperAdmin xem được Analytics.
          </p>
        ) : overview.isError ? (
          <p className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-3 py-10 text-center text-sm text-rose-700">
            Không tải được số liệu. Thử tải lại trang.
          </p>
        ) : overview.isLoading && !stats ? (
          <div className="space-y-4">
            <div className="admin-dash-skel h-40" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="admin-dash-skel h-28" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-5">
              <section className="admin-dash-hero admin-dash-rise p-6 xl:col-span-2">
                <span className="admin-dash-glow -right-8 -top-10 h-32 w-32 bg-[#E8872A]/40" />
                <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Đang truy cập
                </p>
                <p className="relative mt-3 flex items-center gap-3 text-5xl font-bold tracking-tight">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.18)]" />
                  {realtime.data?.activeVisitors ?? 0}
                </p>
                <p className="relative mt-2 text-sm text-white/70">Người dùng trong 5 phút gần nhất</p>
                <ul className="relative mt-5 space-y-2">
                  {(realtime.data?.pages ?? []).length === 0 ? (
                    <li className="text-sm text-white/50">Chưa có ai đang xem.</li>
                  ) : (
                    realtime.data?.pages.slice(0, 4).map((row) => (
                      <li key={row.path} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-white/90">{row.path}</span>
                        <span className="shrink-0 font-semibold text-[#E8872A]">{row.visitors}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:col-span-3">
                <MetricCard label="Người dùng" value={String(stats?.visitors ?? 0)} hint="Khách duy nhất trong kỳ">
                  <Delta current={stats?.visitors ?? 0} previous={previous?.visitors ?? 0} />
                </MetricCard>
                <MetricCard label="Phiên" value={String(stats?.sessions ?? 0)} hint="Mỗi lần ghé, nghỉ 30 phút là phiên mới">
                  <Delta current={stats?.sessions ?? 0} previous={previous?.sessions ?? 0} />
                </MetricCard>
                <MetricCard label="Lượt xem" value={String(stats?.pageviews ?? 0)}>
                  <Delta current={stats?.pageviews ?? 0} previous={previous?.pageviews ?? 0} />
                </MetricCard>
                <MetricCard
                  label="Tỷ lệ tương tác"
                  value={`${stats?.engagementRate ?? 0}%`}
                  hint="Phiên xem từ 2 trang hoặc ở lại từ 10 giây"
                >
                  <Delta current={stats?.engagementRate ?? 0} previous={previous?.engagementRate ?? 0} />
                </MetricCard>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Thời gian trung bình" value={formatDuration(stats?.avgSessionMs ?? 0)} hint="Mỗi phiên">
                <Delta current={stats?.avgSessionMs ?? 0} previous={previous?.avgSessionMs ?? 0} />
              </MetricCard>
              <MetricCard label="Trang mỗi phiên" value={String(stats?.pagesPerSession ?? 0)}>
                <Delta current={stats?.pagesPerSession ?? 0} previous={previous?.pagesPerSession ?? 0} />
              </MetricCard>
              <MetricCard label="Tỷ lệ thoát" value={`${stats?.bounceRate ?? 0}%`} hint="Phiên chỉ xem 1 trang">
                <Delta current={stats?.bounceRate ?? 0} previous={previous?.bounceRate ?? 0} invert />
              </MetricCard>
              <Card className="admin-dash-card !p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Người mới / quay lại</p>
                <p className="mt-2 text-[1.65rem] font-bold leading-none tracking-tight text-[#072348]">
                  {stats?.newVisitors ?? 0}
                  <span className="text-lg font-semibold text-slate-300"> / {stats?.returningVisitors ?? 0}</span>
                </p>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#072348]"
                    style={{ width: audience ? `${Math.round(((stats?.newVisitors ?? 0) / audience) * 100)}%` : '0%' }}
                  />
                  <div
                    className="h-full bg-[#E8872A]"
                    style={{
                      width: audience ? `${Math.round(((stats?.returningVisitors ?? 0) / audience) * 100)}%` : '0%',
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-[#072348]">Mới</span>
                  {' · '}
                  <span className="font-semibold text-[#E8872A]">Quay lại</span>
                </p>
              </Card>
            </div>

            <Card className="admin-dash-card !p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#072348]">Xu hướng</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#072348]" /> Lượt xem
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#E8872A]" /> Người dùng
                  </span>
                </div>
              </div>
              <div className="mt-5 flex h-44 items-end gap-1.5">
                {series.map((point) => (
                  <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-32 w-full items-end justify-center gap-0.5">
                      <div
                        className="admin-dash-bar w-1/2 max-w-3 rounded-t bg-[#072348]"
                        style={{ height: `${Math.max(point.pageviews ? 4 : 0, Math.round((point.pageviews / peak) * 128))}px` }}
                        title={`${point.label}: ${point.pageviews} lượt xem`}
                      />
                      <div
                        className="admin-dash-bar w-1/2 max-w-3 rounded-t bg-[#E8872A]"
                        style={{ height: `${Math.max(point.visitors ? 4 : 0, Math.round((point.visitors / peak) * 128))}px` }}
                        title={`${point.label}: ${point.visitors} người dùng`}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-slate-400">{point.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Trang vào" subtitle="Trang đầu tiên của phiên">
                <ShareList
                  empty="Chưa có phiên."
                  rows={(stats?.landings ?? []).map((row) => ({ label: row.path, value: row.sessions }))}
                />
              </Panel>
              <Panel title="Trang thoát" subtitle="Trang cuối trước khi rời">
                <ShareList
                  empty="Chưa có phiên."
                  rows={(stats?.exits ?? []).map((row) => ({ label: row.path, value: row.sessions }))}
                />
              </Panel>
              <Panel title="Nguồn và thiết bị">
                <ShareList
                  empty="Chưa có nguồn."
                  rows={(stats?.topReferrers ?? []).map((row) => ({ label: row.source, value: row.sessions }))}
                />
                <div className="mt-5 flex flex-wrap gap-2">
                  {(stats?.devices ?? []).map((row) => (
                    <span
                      key={row.device}
                      className="rounded-full bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#072348] ring-1 ring-slate-200"
                    >
                      {DEVICE_LABEL[row.device] ?? row.device}
                      <span className="ml-1 font-medium text-slate-400">
                        {deviceTotal ? Math.round((row.sessions / deviceTotal) * 100) : 0}%
                      </span>
                    </span>
                  ))}
                </div>
              </Panel>
            </div>

            <Card className="admin-dash-card overflow-x-auto !p-0">
              <div className="px-5 pt-5">
                <p className="text-sm font-semibold text-[#072348]">Trang được xem</p>
                <p className="mt-0.5 text-xs text-slate-400">Lượt xem, người dùng và thời gian ở lại trung bình</p>
              </div>
              {(stats?.topPages.length ?? 0) === 0 ? (
                <p className="m-5 rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-8 text-center text-sm text-slate-500">
                  Chưa có lượt xem trong kỳ này.
                </p>
              ) : (
                <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-100 bg-[#f8fafc] text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3 font-semibold">Trang</th>
                      <th className="px-4 py-3 font-semibold">Lượt xem</th>
                      <th className="px-4 py-3 font-semibold">Người dùng</th>
                      <th className="px-5 py-3 font-semibold">Thời gian TB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats?.topPages.map((row) => (
                      <tr key={row.path} className="admin-dash-row">
                        <td className="px-5 py-3 font-medium text-[#072348]">{row.path}</td>
                        <td className="px-4 py-3 text-slate-600">{row.pageviews}</td>
                        <td className="px-4 py-3 text-slate-600">{row.visitors}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {row.avgDurationMs > 0 ? formatDuration(row.avgDurationMs) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#072348]">Phiên truy cập</p>
                  <p className="mt-0.5 text-xs text-slate-400">Mở một phiên để xem IP, trình duyệt và đường đi</p>
                </div>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setOpenId(null);
                    setQ(qInput.trim());
                  }}
                >
                  <Input
                    className="max-w-xs"
                    placeholder="Lọc theo đường dẫn hoặc IP"
                    value={qInput}
                    onChange={(event) => setQInput(event.target.value)}
                  />
                  <Button type="submit" className="!rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]">
                    Lọc
                  </Button>
                </form>
              </div>

              <Card className="admin-dash-card mt-3 overflow-x-auto !p-0">
                {sessions.isLoading ? (
                  <div className="space-y-2 p-4">
                    <div className="admin-dash-skel h-10 rounded-xl" />
                    <div className="admin-dash-skel h-10 rounded-xl" />
                  </div>
                ) : (sessions.data?.items.length ?? 0) === 0 ? (
                  <p className="m-4 rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-10 text-center text-sm text-slate-500">
                    Chưa có phiên truy cập.
                  </p>
                ) : (
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-[#f8fafc] text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3 font-semibold">Thời điểm</th>
                        <th className="px-4 py-3 font-semibold">Đường đi</th>
                        <th className="px-4 py-3 font-semibold">Nguồn</th>
                        <th className="px-4 py-3 font-semibold">Thiết bị</th>
                        <th className="px-4 py-3 font-semibold">Trang</th>
                        <th className="px-4 py-3 font-semibold">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.data?.items.map((row) => {
                        const open = openId === row.sessionId;
                        return (
                          <tr key={row.sessionId} className="admin-dash-row align-top">
                            <td className="px-4 py-3" colSpan={open ? 6 : undefined}>
                              {open ? (
                                <div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-[#E8872A]"
                                    onClick={() => setOpenId(null)}
                                  >
                                    Thu gọn
                                  </button>
                                  {detail.isLoading ? (
                                    <p className="mt-2 text-xs text-slate-400">Đang tải chi tiết…</p>
                                  ) : detail.data ? (
                                    <div className="mt-3 grid gap-3 lg:grid-cols-[260px_1fr]">
                                      <div className="rounded-xl bg-[#f8fafc] p-3 text-xs leading-relaxed text-slate-600">
                                        <p>
                                          <span className="text-slate-400">IP</span>{' '}
                                          <span className="font-semibold text-[#072348]">
                                            {detail.data.ip || 'Không rõ'}
                                          </span>
                                        </p>
                                        {detail.data.ips.length > 1 ? (
                                          <p className="mt-1 text-slate-500">{detail.data.ips.join(', ')}</p>
                                        ) : null}
                                        <p className="mt-2">
                                          <span className="text-slate-400">Nguồn</span> {detail.data.source}
                                        </p>
                                        <p className="mt-1 break-all">
                                          <span className="text-slate-400">Trình duyệt</span>{' '}
                                          {detail.data.userAgent || '—'}
                                        </p>
                                      </div>
                                      <ol className="space-y-1.5 text-xs">
                                        {detail.data.hits.map((hit, index) => (
                                          <li key={`${hit.createdAt}-${index}`} className="flex gap-3">
                                            <span className="w-12 shrink-0 text-slate-400">
                                              {new Date(hit.createdAt).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </span>
                                            <span className="text-slate-700">{hit.path}</span>
                                            <span className="ml-auto shrink-0 text-slate-400">
                                              {hit.durationMs > 0 ? formatDuration(hit.durationMs) : ''}
                                            </span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-rose-600">Không tải được chi tiết phiên.</p>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="text-left text-xs text-slate-500"
                                  onClick={() => setOpenId(row.sessionId)}
                                >
                                  {formatWhen(row.lastSeenAt)}
                                </button>
                              )}
                            </td>
                            {open ? null : (
                              <>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    className="text-left font-medium text-[#072348]"
                                    onClick={() => setOpenId(row.sessionId)}
                                  >
                                    {row.landing === row.path ? row.path : `${row.landing} → ${row.path}`}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{row.source}</td>
                                <td className="px-4 py-3 text-slate-600">{DEVICE_LABEL[row.device] ?? row.device}</td>
                                <td className="px-4 py-3 text-slate-600">{row.pageviews}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  {row.durationMs > 0 ? formatDuration(row.durationMs) : '—'}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              {totalPages > 1 ? (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => {
                      setOpenId(null);
                      setPage((current) => Math.max(1, current - 1));
                    }}
                  >
                    Trước
                  </Button>
                  <span className="text-slate-500">
                    {page}/{totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setOpenId(null);
                      setPage((current) => current + 1);
                    }}
                  >
                    Sau
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
