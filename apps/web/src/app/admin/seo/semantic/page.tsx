'use client';

import type { CmsSemanticIssue, CmsSemanticItem } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui';
import { fetchCmsSemantic } from '@/lib/admin-cms';

const ISSUE_LABEL: Record<CmsSemanticIssue, string> = {
  thin: 'Ít chữ',
  markup: 'Nhiều mã',
  entities: 'Ít thực thể',
};

const KIND_LABEL: Record<CmsSemanticItem['kind'], string> = {
  post: 'Bài viết',
  page: 'Trang',
  category: 'Danh mục',
};

export default function AdminSeoSemanticPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-cms-semantic'],
    queryFn: fetchCmsSemantic,
    refetchOnWindowFocus: true,
  });
  const [filter, setFilter] = useState<'all' | CmsSemanticIssue>('all');
  const items = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.items;
    return data.items.filter((item) => item.issues.includes(filter));
  }, [data, filter]);
  const markup = useMemo(() => data?.items.filter((item) => item.issues.includes('markup')).length ?? 0, [data]);

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">Semantic content</p>
            <h1 className="cms-page-title mt-1.5">AI Overviews</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2 max-w-2xl">
              Đo tỷ lệ chữ trên HTML và thực thể của nội dung đã xuất bản. Quét thực thể B2B bằng Gemini SEO nằm trong trình soạn bài.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/seo" className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]">
              SEO overview
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
            {error instanceof Error ? error.message : 'Không tải được báo cáo nội dung.'}
          </p>
        ) : (
          <section className="admin-dash-card admin-dash-rise p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tỷ lệ chữ & thực thể</h2>
                <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                  Trang danh mục được tải như Googlebot, đo trên toàn bộ HTML gồm script và style. «Nhiều mã» khi dưới 10% chữ và dưới 1.500 ký tự nội dung.
                </p>
              </div>
              <div className="flex flex-wrap rounded-xl bg-[#f8fafc] p-1 ring-1 ring-slate-200">
                {(
                  [
                    ['all', 'Tất cả'],
                    ['thin', 'Ít chữ'],
                    ['markup', 'Nhiều mã'],
                    ['entities', 'Ít thực thể'],
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Đã quét" value={data.scanned} />
              <Stat label="Đạt" value={data.ok} tone="good" />
              <Stat label="Ít chữ" value={data.thin} tone={data.thin > 0 ? 'bad' : undefined} />
              <Stat label="Nhiều mã" value={markup} tone={markup > 0 ? 'bad' : undefined} />
              <Stat label="Ít thực thể" value={data.fewEntities} tone={data.fewEntities > 0 ? 'warn' : undefined} />
            </div>

            <ItemList items={items} />
            <p className="mt-4 text-xs text-slate-400">Cập nhật {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-2xl bg-[#f8fafc] px-4 py-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-red-700' : 'text-[#072348]',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ItemList({ items }: { items: CmsSemanticItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        Không có mục nào trong bộ lọc này.
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f8fafc] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
              {KIND_LABEL[item.kind]}
            </span>
            <Link href={item.editPath} className="min-w-0 flex-1 truncate text-sm font-semibold text-[#072348] hover:text-accent-600">
              {item.title}
            </Link>
            {item.issues.map((issue) => (
              <span
                key={issue}
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  issue === 'entities' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700',
                )}
              >
                {ISSUE_LABEL[issue]}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Nội dung: {item.textChars} chữ · {item.ratio}% chữ trên HTML
            {item.entities.length > 0 ? ` · ${item.entities.join(', ')}` : ''}
          </p>
          {item.page ? <PageRatio page={item.page} /> : null}
        </li>
      ))}
    </ul>
  );
}

function PageRatio({ page }: { page: NonNullable<CmsSemanticItem['page']> }) {
  if (page.error) {
    return (
      <p className="mt-2 rounded-lg bg-[#f8fafc] px-3 py-1.5 text-xs text-slate-500 ring-1 ring-slate-100">
        Trang {page.path}: {page.error}
      </p>
    );
  }
  const warn = page.verdict === 'warn';
  return (
    <div className={clsx('mt-2 rounded-xl px-3 py-2 ring-1', warn ? 'bg-red-50/60 ring-red-100' : 'bg-[#f8fafc] ring-slate-100')}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">Trang công khai {page.path}</span>
        <span className={clsx('font-semibold tabular-nums', warn ? 'text-red-700' : 'text-emerald-700')}>
          {page.ratio}% chữ · {page.textChars} chữ
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-[#072348]" style={{ width: `${Math.min(100, page.ratio)}%` }} />
        <div className="h-full bg-[#E8872A]" style={{ width: `${Math.min(100 - Math.min(100, page.ratio), page.codeShare)}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        <span className="font-semibold text-[#072348]">■</span> chữ · <span className="font-semibold text-[#E8872A]">■</span> script + style {page.codeShare}% · phần xám là thẻ HTML
      </p>
    </div>
  );
}
