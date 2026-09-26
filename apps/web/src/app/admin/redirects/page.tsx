'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { deleteCmsRedirect, listCmsRedirects, upsertCmsRedirect } from '@/lib/admin-cms';

export default function AdminRedirectsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cms-redirects'],
    queryFn: listCmsRedirects,
  });
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => upsertCmsRedirect({ fromPath, toPath, note: note || null, statusCode: 301 }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-redirects'] });
      setFromPath('');
      setToPath('');
      setNote('');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Lưu thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCmsRedirect,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-redirects'] });
    },
  });

  const rows = Array.isArray(data) ? data : [];

  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Cấu hình</p>
        <h1 className="cms-page-title mt-1.5">Redirect 301</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-xl">
          301 khi đổi slug bài hoặc trang, kể cả redirect thêm tay. Giữ link cũ cho crawler.
        </p>
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <form
          className="admin-dash-card admin-dash-rise space-y-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <h2 className="text-sm font-semibold text-[#072348]">Thêm redirect</h2>
          <Field label="From path">
            <Input
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder="/cam-nang/slug-cu"
              required
            />
          </Field>
          <Field label="To path">
            <Input
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/cam-nang/slug-moi"
              required
            />
          </Field>
          <Field label="Ghi chú">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu 301'}
          </button>
        </form>

        <aside className="admin-dash-card admin-dash-rise h-fit p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#072348]">Lịch sử</h2>
            <span className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]">
              {isLoading ? '…' : rows.length}
            </span>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-2">
              <div className="admin-dash-skel h-16" />
              <div className="admin-dash-skel h-16" />
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-8 text-center text-sm text-slate-500">
              Chưa có redirect.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="admin-dash-row flex items-start justify-between gap-3 rounded-2xl px-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-500">{r.fromPath}</p>
                    <p className="truncate font-mono text-xs font-semibold text-[#072348]">→ {r.toPath}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        {r.statusCode}
                      </span>
                      {r.note ? <span className="truncate text-[11px] text-slate-400">{r.note}</span> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={clsx(
                      'shrink-0 text-xs font-semibold text-rose-600',
                      deleteMutation.isPending && 'opacity-50',
                    )}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm('Xoá redirect này?')) deleteMutation.mutate(r.id);
                    }}
                  >
                    Xoá
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
