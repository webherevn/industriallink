'use client';

import type {
  CmsSeoIssueGroup,
  CmsSeoIssueSeverity,
  CmsSeoOverview,
} from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderTree,
  Info,
  Link2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
import { fetchCmsOverview } from '@/lib/admin-cms';

type SeverityFilter = 'all' | CmsSeoIssueSeverity;

function gradeMeta(grade: CmsSeoOverview['healthGrade']) {
  if (grade === 'great')
    return { label: 'Rất tốt', color: 'text-emerald-600', ring: 'border-emerald-400', bar: 'bg-emerald-500' };
  if (grade === 'good')
    return { label: 'Tốt', color: 'text-emerald-600', ring: 'border-emerald-400', bar: 'bg-emerald-500' };
  if (grade === 'ok')
    return { label: 'Cần cải thiện', color: 'text-amber-600', ring: 'border-amber-400', bar: 'bg-amber-500' };
  return { label: 'Yếu', color: 'text-rose-600', ring: 'border-rose-400', bar: 'bg-rose-500' };
}

function severityMeta(severity: CmsSeoIssueSeverity) {
  if (severity === 'critical')
    return {
      label: 'Critical',
      icon: ShieldAlert,
      chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
      dot: 'bg-rose-500',
    };
  if (severity === 'warning')
    return {
      label: 'Warning',
      icon: AlertTriangle,
      chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
      dot: 'bg-amber-500',
    };
  return {
    label: 'Info',
    icon: Info,
    chip: 'bg-sky-50 text-sky-800 ring-1 ring-sky-100',
    dot: 'bg-sky-500',
  };
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ScoreHero({ data }: { data: CmsSeoOverview }) {
  const g = gradeMeta(data.healthGrade);
  const critical = data.issues.filter((i) => i.severity === 'critical').reduce((s, i) => s + i.count, 0);
  const warning = data.issues.filter((i) => i.severity === 'warning').reduce((s, i) => s + i.count, 0);
  const info = data.issues.filter((i) => i.severity === 'info').reduce((s, i) => s + i.count, 0);

  return (
    <Card className="relative overflow-hidden border-slate-200/80 bg-gradient-to-br from-white via-white to-brand-50/40 p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div
            className={clsx(
              'flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full border-[4px] bg-white shadow-sm',
              g.ring,
            )}
          >
            <span className={clsx('text-3xl font-bold leading-none tracking-tight', g.color)}>
              {data.healthScore}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              /100
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Site SEO Health
            </p>
            <h2 className={clsx('mt-1 text-2xl font-bold tracking-tight', g.color)}>{g.label}</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Điểm tổng hợp từ coverage on-page, indexability và số vấn đề critical trên nội dung đã
              xuất bản.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Cập nhật {formatTime(data.generatedAt)} · {data.siteUrl.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:min-w-[280px]">
          {[
            { label: 'Critical', value: critical, className: 'text-rose-600' },
            { label: 'Warning', value: warning, className: 'text-amber-600' },
            { label: 'Info', value: info, className: 'text-sky-600' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-3 text-center"
            >
              <p className={clsx('text-2xl font-bold tabular-nums', s.className)}>{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function InventoryGrid({ data }: { data: CmsSeoOverview }) {
  const inv = data.inventory;
  const items = [
    { label: 'Post published', value: inv.publishedPosts, href: '/admin/posts', icon: FileText },
    { label: 'Page published', value: inv.publishedPages, href: '/admin/pages', icon: FileText },
    { label: 'Drafts', value: inv.drafts, href: '/admin/posts', icon: FileText },
    { label: 'Danh mục', value: inv.categories, href: '/admin/categories', icon: FolderTree },
    { label: 'Tác giả public', value: inv.publicAuthors, href: '/admin/author', icon: UserRound },
    { label: 'Redirects', value: inv.redirects, href: '/admin/redirects', icon: Link2 },
    { label: 'Noindex live', value: inv.noindexPublished, href: '/admin/seo', icon: ShieldAlert },
    { label: 'Archived', value: inv.archived, href: '/admin/posts', icon: FileText },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href}>
            <Card className="flex items-center gap-3 transition hover:border-brand-200 hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {item.label}
                </p>
                <p className="text-2xl font-bold tabular-nums text-[var(--brand-navy)]">
                  {item.value}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function CoveragePanel({ data }: { data: CmsSeoOverview }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Coverage checklist</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tỷ lệ nội dung published đạt chuẩn từng tín hiệu SEO.
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-accent-500" />
      </div>
      <ul className="space-y-3.5">
        {data.coverage.map((c) => (
          <li key={c.id}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800">{c.label}</span>
              <span className="tabular-nums text-slate-500">
                {c.done}/{c.total} · {c.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  c.percent >= 80
                    ? 'bg-emerald-500'
                    : c.percent >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                )}
                style={{ width: `${c.percent}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{c.hint}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function IssuesPanel({
  issues,
  filter,
  onFilter,
}: {
  issues: CmsSeoIssueGroup[];
  filter: SeverityFilter;
  onFilter: (f: SeverityFilter) => void;
}) {
  const filtered = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.severity === filter)),
    [issues, filter],
  );
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    setOpenCode(filtered[0]?.code ?? null);
  }, [filter, filtered]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Vấn đề cần xử lý</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Click nhóm để xem danh sách và nhảy thẳng vào trang sửa.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Tất cả'],
              ['critical', 'Critical'],
              ['warning', 'Warning'],
              ['info', 'Info'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilter(id)}
              className={clsx(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                filter === id
                  ? 'bg-[var(--brand-navy)] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-6 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Không còn vấn đề ở mức này — SEO inventory đang sạch.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((group) => {
            const meta = severityMeta(group.severity);
            const Icon = meta.icon;
            const open = openCode === group.code;
            return (
              <li
                key={group.code}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenCode(open ? null : group.code)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                >
                  <span className={clsx('mt-0.5 rounded-md p-1.5', meta.chip)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                      <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-bold', meta.chip)}>
                        {group.count}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <ul className="border-t border-slate-100 bg-slate-50/50 px-2 py-2">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.editPath}
                          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-white"
                        >
                          <span
                            className={clsx(
                              'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                              item.kind === 'post'
                                ? 'bg-brand-50 text-brand-700'
                                : item.kind === 'page'
                                  ? 'bg-violet-50 text-violet-700'
                                  : item.kind === 'category'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {item.kind}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                            {item.title}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </Link>
                      </li>
                    ))}
                    {group.count > group.items.length && (
                      <li className="px-3 py-1.5 text-[11px] text-slate-400">
                        +{group.count - group.items.length} mục khác…
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function KeywordsPanel({ data }: { data: CmsSeoOverview }) {
  if (data.topKeywords.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-bold text-slate-900">Focus keywords</h3>
        <p className="mt-3 text-sm text-slate-500">Chưa có focus keyword trên nội dung published.</p>
      </Card>
    );
  }
  const max = data.topKeywords[0]?.count ?? 1;
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Top focus keywords</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Theo dõi mật độ từ khóa & cạnh tranh nội bộ (cannibalization).
        </p>
      </div>
      <ul className="space-y-2.5">
        {data.topKeywords.map((k) => (
          <li key={k.keyword} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-slate-800">{k.keyword}</span>
                <span
                  className={clsx(
                    'tabular-nums font-bold',
                    k.count >= 2 ? 'text-amber-600' : 'text-slate-500',
                  )}
                >
                  {k.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx(
                    'h-full rounded-full',
                    k.count >= 2 ? 'bg-amber-500' : 'bg-brand-500',
                  )}
                  style={{ width: `${Math.max(8, (k.count / max) * 100)}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecentPanel({ data }: { data: CmsSeoOverview }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Published gần đây</h3>
          <p className="mt-0.5 text-xs text-slate-500">Kiểm tra nhanh tín hiệu SEO của bài mới.</p>
        </div>
        <Link href="/admin/posts" className="text-xs font-semibold text-brand-600 hover:underline">
          Tất cả →
        </Link>
      </div>
      {data.recentPublished.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có nội dung published.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.recentPublished.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0">
              <Link
                href={item.editPath}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 hover:text-accent-600"
              >
                {item.title}
              </Link>
              <div className="flex flex-wrap gap-1">
                <Flag ok={item.hasSeoTitle} label="Title" />
                <Flag ok={item.hasFocusKeyword} label="KW" />
                <Flag ok={item.hasOgImage} label="OG" />
                <Flag ok={item.robotsIndex} label="Index" />
              </div>
              {item.publicPath ? (
                <a
                  href={item.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-brand-600"
                  aria-label="Xem public"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-0.5 text-[10px] font-bold',
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600',
      )}
    >
      {label}
    </span>
  );
}

function TechLinks({ data }: { data: CmsSeoOverview }) {
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Technical & quick links</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Sitemap, robots và lối tắt quản trị nội dung.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.quickLinks.map((link) => (
          <li key={link.href + link.label}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-accent-200 hover:text-brand-700"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
            ) : (
              <Link
                href={link.href}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-accent-200 hover:text-brand-700"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AdminSeoOverviewPage() {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const { data, isLoading, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['admin-cms-overview'],
    queryFn: fetchCmsOverview,
    refetchOnWindowFocus: true,
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title">SEO overview</h1>
          <p className="cms-page-subtitle">
            Audit sức khỏe SEO toàn site — coverage, issues, keywords & technical links.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="gap-1.5"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Card className="h-36 animate-pulse bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-20 animate-pulse bg-slate-100" />
            ))}
          </div>
        </div>
      ) : isError || !data ? (
        <Card className="mt-6 border-rose-200 bg-rose-50/50 py-10 text-center">
          <p className="text-sm font-semibold text-rose-700">Không tải được SEO overview</p>
          <p className="mt-1 text-xs text-rose-600">
            {error instanceof Error ? error.message : 'Thử làm mới trang.'}
          </p>
        </Card>
      ) : (
        <div className="mt-5 space-y-5">
          <ScoreHero data={data} />
          <InventoryGrid data={data} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <IssuesPanel issues={data.issues} filter={filter} onFilter={setFilter} />
            <div className="space-y-5">
              <CoveragePanel data={data} />
              <KeywordsPanel data={data} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <RecentPanel data={data} />
            <TechLinks data={data} />
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default AdminSeoOverviewPage;
