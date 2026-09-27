'use client';

import type { CmsBrokenLink } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui';
import { fetchLinkAudit, upsertCmsRedirect } from '@/lib/admin-cms';

export default function AdminSeoLinksPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-link-audit'],
    queryFn: fetchLinkAudit,
    refetchOnWindowFocus: true,
  });
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const createRedirect = useMutation({
    mutationFn: (item: { path: string; toPath: string }) =>
      upsertCmsRedirect({
        fromPath: item.path,
        toPath: item.toPath,
        statusCode: 301,
        note: 'SEO: URL không còn trang',
      }),
    onSuccess: async (_row, item) => {
      setNotice(`Đã tạo 301 từ ${item.path} sang ${item.toPath}.`);
      setRowError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-link-audit'] });
    },
    onError: (err) => {
      setNotice(null);
      setRowError(err instanceof Error ? err.message : 'Không tạo được redirect.');
    },
    onSettled: () => setBusy(null),
  });

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">Link architecture</p>
            <h1 className="cms-page-title mt-1.5">Link nội bộ</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2 max-w-2xl">
              Link trong nội dung đã xuất bản trỏ tới URL không tồn tại, và đường dẫn khách đã mở trong 14 ngày qua nhưng không có trang.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/seo" className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]">
              SEO overview
            </Link>
            <Link href="/admin/redirects" className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]">
              Redirect
            </Link>
            <Button type="button" variant="ghost" className="gap-1.5 shadow-sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {notice ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>
        ) : null}
        {rowError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{rowError}</p>
        ) : null}

        {isLoading ? (
          <div className="admin-dash-skel h-40" />
        ) : isError || !data ? (
          <p className="rounded-[1.15rem] border border-dashed border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Không tải được báo cáo link.'}
          </p>
        ) : (
          <>
            <LinkTable
              title="Link gãy trong nội dung"
              description="Link nội bộ trong bài viết, trang và danh mục đã xuất bản trỏ tới URL không có trang. Tạo 301 để giữ link và traffic."
              empty="Không thấy link nội bộ nào trỏ tới trang không tồn tại."
              rows={data.broken}
              showSources
              targets={targets}
              busy={busy}
              onTarget={(path, value) => setTargets((current) => ({ ...current, [path]: value }))}
              onCreate={(row) => {
                const toPath = (targets[row.path] ?? row.suggestedTo).trim();
                setBusy(row.path);
                createRedirect.mutate({ path: row.path, toPath });
              }}
            />
            <LinkTable
              title="URL khách đã mở, không có trang"
              description="Đường dẫn có lượt xem trong 14 ngày qua nhưng không khớp bài, trang, danh mục, tin tuyển dụng hay redirect nào."
              empty="14 ngày qua không có lượt xem nào tới URL lạ."
              rows={data.unknownHits}
              targets={targets}
              busy={busy}
              onTarget={(path, value) => setTargets((current) => ({ ...current, [path]: value }))}
              onCreate={(row) => {
                const toPath = (targets[row.path] ?? row.suggestedTo).trim();
                setBusy(row.path);
                createRedirect.mutate({ path: row.path, toPath });
              }}
            />
            <p className="text-xs text-slate-400">Cập nhật {new Date(data.generatedAt).toLocaleString('vi-VN')}</p>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function LinkTable({
  title,
  description,
  empty,
  rows,
  showSources,
  targets,
  busy,
  onTarget,
  onCreate,
}: {
  title: string;
  description: string;
  empty: string;
  rows: CmsBrokenLink[];
  showSources?: boolean;
  targets: Record<string, string>;
  busy: string | null;
  onTarget: (path: string, value: string) => void;
  onCreate: (row: CmsBrokenLink) => void;
}) {
  return (
    <section className="admin-dash-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{description}</p>
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1',
            rows.length > 0 ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
          )}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {empty}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map((row) => {
            const toPath = targets[row.path] ?? row.suggestedTo;
            const same = toPath.trim() === row.path;
            return (
              <li key={row.path} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-md bg-[#f8fafc] px-2 py-0.5 text-sm font-semibold text-[#072348] ring-1 ring-slate-200">
                      {row.path}
                    </code>
                    {row.hits > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {row.hits} lượt / 14 ngày
                      </span>
                    ) : null}
                  </div>
                  {showSources && row.sources.length > 0 ? (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Có trong{' '}
                      {row.sources.map((source, index) => (
                        <span key={source.editPath}>
                          {index > 0 ? ', ' : ''}
                          <Link href={source.editPath} className="font-semibold text-[#072348] hover:text-accent-600">
                            {source.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    301 sang
                    <input
                      className="h-9 w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFF8F1]"
                      value={toPath}
                      onChange={(event) => onTarget(row.path, event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={same || busy === row.path}
                    className="h-9 rounded-xl bg-[#E8872A] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#D06F18] disabled:opacity-40"
                    onClick={() => onCreate(row)}
                  >
                    {busy === row.path ? 'Đang tạo…' : 'Tạo 301'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
