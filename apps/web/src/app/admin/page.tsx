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
  },
  {
    href: '/admin/pages/new',
    label: 'Tạo trang',
    hint: 'Landing / tĩnh',
    icon: FilePlus2,
  },
  {
    href: '/admin/categories',
    label: 'Danh mục',
    hint: 'Silo nội dung',
    icon: FolderTree,
  },
  {
    href: '/admin/author',
    label: 'Hồ sơ tác giả',
    hint: 'E-E-A-T / Person',
    icon: UserRound,
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
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  const issueTotal = issues.reduce((s, i) => s + i.count, 0);
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const attention = [...critical, ...warnings].slice(0, 5);
  const recentPublished = Array.isArray(data?.recentPublished) ? data.recentPublished : [];
  const coverage = Array.isArray(data?.coverage) ? data.coverage : [];

  const published = (inv?.publishedPosts ?? 0) + (inv?.publishedPages ?? 0);
  const drafts = inv?.drafts ?? 0;
  const archived = inv?.archived ?? 0;
  const pipelineTotal = Math.max(published + drafts + archived, 1);

  const roleLabel = me?.role === UserRole.Editor ? 'Biên tập viên' : 'Superadmin';

  const ringR = 30;
  const ringFull = 2 * Math.PI * ringR;
  const ringOffset = data ? ringFull - (data.healthScore / 100) * ringFull : ringFull;

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            {greeting()}
          </p>
          <h1 className="cms-page-title mt-1.5">
            {me?.displayName ? me.displayName : 'Dashboard'}
          </h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
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
            className="gap-1.5 shadow-sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Làm mới
          </Button>
          <Link href="/admin/posts/new">
            <Button type="button" className="gap-1.5 shadow-md shadow-[rgba(7,35,72,0.25)]">
              <Plus className="h-4 w-4" />
              Viết bài
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="admin-dash-skel h-40" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-24" />
            ))}
          </div>
        </div>
      ) : isError || !data || !inv ? (
        <Card className="border-rose-200 bg-rose-50/50 py-10 text-center">
          <p className="text-sm font-semibold text-rose-700">Không tải được dashboard</p>
          <p className="mt-1 text-xs text-rose-600">Thử làm mới hoặc kiểm tra API.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div
            className="admin-dash-rise grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
            style={{ animationDelay: '70ms' }}
          >
            <Link href="/admin/seo" className="admin-dash-hero block h-full p-5 sm:p-6">
              <span className="admin-dash-glow -right-8 -top-10 h-40 w-40 bg-accent-500/40" aria-hidden />
              <span className="admin-dash-glow -bottom-16 left-1/3 h-32 w-32 bg-sky-400/20" aria-hidden />
              <div className="relative flex flex-wrap items-center gap-5">
                <div className="relative h-[96px] w-[96px] shrink-0">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden>
                    <circle cx="40" cy="40" r={ringR} stroke="rgba(255,255,255,0.16)" strokeWidth="6" fill="none" />
                    <circle
                      className="admin-dash-ring"
                      cx="40"
                      cy="40"
                      r={ringR}
                      stroke="#E8872A"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      style={{
                        ['--ring-full' as string]: ringFull,
                        ['--ring-offset' as string]: ringOffset,
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold leading-none">{data.healthScore}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">/100</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-300">
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
            </Link>

            <div className="admin-dash-card flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Pipeline nội dung</h2>
                  <Sparkles className="h-4 w-4 text-accent-500" />
                </div>
                <p className="mt-1 text-xs text-slate-500">Published · Draft · Archived</p>
              </div>
              <div className="mt-5">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="admin-dash-bar h-full bg-emerald-500"
                    style={{ width: `${(published / pipelineTotal) * 100}%`, animationDelay: '80ms' }}
                    title="Published"
                  />
                  <div
                    className="admin-dash-bar h-full bg-amber-400"
                    style={{ width: `${(drafts / pipelineTotal) * 100}%`, animationDelay: '160ms' }}
                    title="Drafts"
                  />
                  <div
                    className="admin-dash-bar h-full bg-slate-300"
                    style={{ width: `${(archived / pipelineTotal) * 100}%`, animationDelay: '220ms' }}
                    title="Archived"
                  />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Live', value: published, tone: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Draft', value: drafts, tone: 'text-amber-700 bg-amber-50' },
                    { label: 'Archive', value: archived, tone: 'text-slate-600 bg-slate-50' },
                  ].map((cell) => (
                    <div key={cell.label} className={clsx('rounded-xl px-2 py-2.5', cell.tone)}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {cell.label}
                      </dt>
                      <dd className="mt-0.5 text-xl font-bold tabular-nums">{cell.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className="admin-dash-rise" style={{ animationDelay: '140ms' }}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Thao tác nhanh
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                const primary = a.href === '/admin/posts/new';
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={clsx(
                      'admin-dash-lift flex items-center gap-3 rounded-[1.15rem] px-4 py-3.5',
                      primary
                        ? 'bg-[var(--brand-navy)] text-white shadow-[0_16px_32px_-18px_rgba(7,35,72,0.8)]'
                        : 'admin-dash-card',
                    )}
                  >
                    <div
                      className={clsx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        primary ? 'bg-white/15 text-accent-300' : 'bg-[var(--brand-accent-soft)] text-accent-600',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{a.label}</p>
                      <p className={clsx('text-[11px]', primary ? 'text-white/70' : 'text-slate-500')}>
                        {a.hint}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div
            className="admin-dash-rise grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            style={{ animationDelay: '200ms' }}
          >
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
                <Link key={item.label} href={item.href} className="admin-dash-card block h-full p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </p>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-accent-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-3 text-[1.65rem] font-bold tabular-nums leading-none tracking-tight text-[var(--brand-navy)]">
                    {item.value}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400">{item.sub}</p>
                </Link>
              );
            })}
          </div>

          <div
            className="admin-dash-rise grid gap-5 xl:grid-cols-2"
            style={{ animationDelay: '260ms' }}
          >
            <div className="admin-dash-card space-y-4 p-5 sm:p-6">
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
                        className="admin-dash-row flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 hover:border-accent-200"
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
            </div>

            <div className="admin-dash-card space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Published gần đây</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Bài / trang mới nhất trên site.</p>
                </div>
                <Link href="/admin/posts" className="text-xs font-semibold text-brand-600 hover:underline">
                  Tất cả →
                </Link>
              </div>
              {recentPublished.length === 0 ? (
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
                <ul className="space-y-1">
                  {recentPublished.slice(0, 6).map((item) => (
                    <li key={item.id} className="admin-dash-row flex items-center gap-3 rounded-xl px-2 py-2">
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
            </div>
          </div>

          <div className="admin-dash-card admin-dash-rise space-y-4 p-5 sm:p-6" style={{ animationDelay: '320ms' }}>
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
              {coverage.slice(0, 4).map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{c.label}</span>
                    <span className="tabular-nums text-slate-500">{c.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={clsx(
                        'admin-dash-bar h-full rounded-full',
                        c.percent >= 80
                          ? 'bg-emerald-500'
                          : c.percent >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                      )}
                      style={{ width: `${c.percent}%`, animationDelay: '180ms' }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {c.done}/{c.total} · {c.hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminShell>
  );
}
