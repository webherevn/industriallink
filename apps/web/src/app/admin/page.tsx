'use client';

import type { CmsSeoOverview } from '@industriallink/contracts';
import { UserRole } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowUpRight,
  FilePlus2,
  FileText,
  FolderTree,
  Link2,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
import { fetchCmsOverview } from '@/lib/admin-cms';
import { fetchMe } from '@/lib/auth';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function gradeMeta(grade: CmsSeoOverview['healthGrade']) {
  if (grade === 'great' || grade === 'good')
    return { label: grade === 'great' ? 'Rất tốt' : 'Tốt', color: 'text-emerald-600', ring: 'border-emerald-400' };
  if (grade === 'ok')
    return { label: 'Cần cải thiện', color: 'text-amber-600', ring: 'border-amber-400' };
  return { label: 'Yếu', color: 'text-rose-600', ring: 'border-rose-400' };
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

const QUICK_ACTIONS = [
  {
    href: '/admin/posts/new',
    label: 'Viết bài mới',
    hint: 'Cẩm nang / blog',
    icon: PenLine,
    tone: 'bg-[var(--brand-navy)] text-white hover:bg-brand-700',
  },
  {
    href: '/admin/pages/new',
    label: 'Tạo trang',
    hint: 'Landing / tĩnh',
    icon: FilePlus2,
    tone: 'bg-white text-slate-800 ring-1 ring-slate-200 hover:border-accent-200 hover:ring-accent-200',
  },
  {
    href: '/admin/categories',
    label: 'Danh mục',
    hint: 'Silo nội dung',
    icon: FolderTree,
    tone: 'bg-white text-slate-800 ring-1 ring-slate-200 hover:ring-accent-200',
  },
  {
    href: '/admin/author',
    label: 'Hồ sơ tác giả',
    hint: 'E-E-A-T / Person',
    icon: UserRound,
    tone: 'bg-white text-slate-800 ring-1 ring-slate-200 hover:ring-accent-200',
  },
] as const;

export default function AdminDashboardPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ['admin-cms-overview'],
    queryFn: fetchCmsOverview,
  });

  const inv = data?.inventory;
  const g = data ? gradeMeta(data.healthGrade) : null;
  const issueTotal = data?.issues.reduce((s, i) => s + i.count, 0) ?? 0;
  const critical = data?.issues.filter((i) => i.severity === 'critical') ?? [];
  const warnings = data?.issues.filter((i) => i.severity === 'warning') ?? [];
  const attention = [...critical, ...warnings].slice(0, 5);

  const published = (inv?.publishedPosts ?? 0) + (inv?.publishedPages ?? 0);
  const drafts = inv?.drafts ?? 0;
  const archived = inv?.archived ?? 0;
  const pipelineTotal = Math.max(published + drafts + archived, 1);

  const roleLabel = me?.role === UserRole.Editor ? 'Biên tập viên' : 'Superadmin';

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            {greeting()}
          </p>
          <h1 className="cms-page-title mt-1">
            {me?.displayName ? `${me.displayName}` : 'Dashboard'}
          </h1>
          <p className="cms-page-subtitle">
            {roleLabel} · Trung tâm vận hành CMS & SEO
            {me?.role === UserRole.SuperAdmin ? (
              <>
                {' · '}
                <Link href="/admin/reports" className="font-semibold text-brand-600 hover:underline">
                  Báo cáo nền tảng
                </Link>
              </>
            ) : null}
            {data ? ` · cập nhật ${formatShortDate(data.generatedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Link href="/admin/posts/new">
            <Button type="button" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Viết bài
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Card className="h-36 animate-pulse bg-slate-100" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-24 animate-pulse bg-slate-100" />
            ))}
          </div>
        </div>
      ) : isError || !data || !inv ? (
        <Card className="mt-6 border-rose-200 bg-rose-50/50 py-10 text-center">
          <p className="text-sm font-semibold text-rose-700">Không tải được dashboard</p>
          <p className="mt-1 text-xs text-rose-600">Thử làm mới hoặc kiểm tra API.</p>
        </Card>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Hero: SEO + pipeline */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Link href="/admin/seo" className="block">
              <Card className="relative h-full overflow-hidden border-slate-200/80 bg-gradient-to-br from-[var(--brand-navy)] via-[#0a2f5c] to-[#0d3a6e] p-5 text-white transition hover:shadow-lg sm:p-6">
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-500/25 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex flex-wrap items-center gap-5">
                  <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border-[3px] border-white/40 bg-white/10 backdrop-blur">
                    <span className="text-2xl font-bold leading-none">{data.healthScore}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">
                      /100
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300">
                      SEO Health
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight">{g?.label}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {issueTotal} vấn đề mở · {critical.reduce((s, i) => s + i.count, 0)} critical ·{' '}
                      {warnings.reduce((s, i) => s + i.count, 0)} warning
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-300">
                      Mở SEO overview <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>

            <Card className="flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Pipeline nội dung</h2>
                  <Sparkles className="h-4 w-4 text-accent-500" />
                </div>
                <p className="mt-1 text-xs text-slate-500">Published · Draft · Archived</p>
              </div>
              <div className="mt-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(published / pipelineTotal) * 100}%` }}
                    title="Published"
                  />
                  <div
                    className="bg-amber-400 transition-all"
                    style={{ width: `${(drafts / pipelineTotal) * 100}%` }}
                    title="Drafts"
                  />
                  <div
                    className="bg-slate-300 transition-all"
                    style={{ width: `${(archived / pipelineTotal) * 100}%` }}
                    title="Archived"
                  />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Live
                    </dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">
                      {published}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Draft
                    </dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums text-amber-600">{drafts}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Archive
                    </dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums text-slate-500">
                      {archived}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Thao tác nhanh
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Link key={a.href} href={a.href}>
                    <div
                      className={clsx(
                        'flex items-center gap-3 rounded-xl px-4 py-3.5 transition shadow-sm',
                        a.tone,
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          a.href === '/admin/posts/new' ? 'bg-white/15' : 'bg-brand-50 text-brand-700',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{a.label}</p>
                        <p
                          className={clsx(
                            'text-[11px]',
                            a.href === '/admin/posts/new' ? 'text-white/70' : 'text-slate-500',
                          )}
                        >
                          {a.hint}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Bài viết', value: inv.posts, sub: `${inv.publishedPosts} live`, href: '/admin/posts', icon: FileText },
              { label: 'Trang', value: inv.pages, sub: `${inv.publishedPages} live`, href: '/admin/pages', icon: FileText },
              { label: 'Danh mục', value: inv.categories, sub: 'chuyên mục', href: '/admin/categories', icon: FolderTree },
              { label: 'Tác giả', value: inv.publicAuthors, sub: 'public', href: '/admin/author', icon: UserRound },
              { label: 'Redirect', value: inv.redirects, sub: '301', href: '/admin/redirects', icon: Link2 },
              { label: 'Noindex', value: inv.noindexPublished, sub: 'đã publish', href: '/admin/seo', icon: ShieldAlert },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href}>
                  <Card className="h-full transition hover:border-brand-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {item.label}
                      </p>
                      <Icon className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[var(--brand-navy)]">
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.sub}</p>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Attention + Recent */}
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Cần chú ý</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Critical & warning từ SEO audit — xử lý ưu tiên.
                  </p>
                </div>
                <Link href="/admin/seo" className="text-xs font-semibold text-brand-600 hover:underline">
                  Chi tiết →
                </Link>
              </div>
              {attention.length === 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-6 text-center text-sm text-emerald-800">
                  Không có critical/warning — inventory đang ổn.
                </div>
              ) : (
                <ul className="space-y-2">
                  {attention.map((group) => (
                    <li key={group.code}>
                      <Link
                        href="/admin/seo"
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3 transition hover:border-accent-200 hover:bg-white"
                      >
                        <span
                          className={clsx(
                            'mt-0.5 rounded-md p-1.5',
                            group.severity === 'critical'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-amber-50 text-amber-700',
                          )}
                        >
                          {group.severity === 'critical' ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                              {group.count}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {group.description}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Published gần đây</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Bài / trang mới nhất trên site.</p>
                </div>
                <Link href="/admin/posts" className="text-xs font-semibold text-brand-600 hover:underline">
                  Tất cả →
                </Link>
              </div>
              {data.recentPublished.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">Chưa có nội dung published.</p>
                  <Link
                    href="/admin/posts/new"
                    className="mt-2 inline-flex text-sm font-semibold text-brand-600 hover:underline"
                  >
                    Viết bài đầu tiên →
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentPublished.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                          item.kind === 'page'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-brand-50 text-brand-700',
                        )}
                      >
                        {item.kind}
                      </span>
                      <Link
                        href={item.editPath}
                        className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 hover:text-accent-600"
                      >
                        {item.title}
                      </Link>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                        {formatShortDate(item.publishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Coverage snapshot */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">SEO coverage snapshot</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tỷ lệ published đạt chuẩn các tín hiệu chính.
                </p>
              </div>
              <Link
                href="/admin/seo"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
              >
                <Search className="h-3.5 w-3.5" />
                Audit đầy đủ
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.coverage.slice(0, 4).map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{c.label}</span>
                    <span className="tabular-nums text-slate-500">{c.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        c.percent >= 80
                          ? 'bg-emerald-500'
                          : c.percent >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                      )}
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {c.done}/{c.total} · {c.hint}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
