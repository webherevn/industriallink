'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
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

  return (
    <AdminShell>
      <h1 className="cms-page-title">Redirect Manager</h1>
      <p className="cms-page-subtitle">
        301 khi đổi slug bài/trang (tự ghi) hoặc thêm tay. Bảo vệ crawl budget & link cũ.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Thêm redirect</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saveMutation.isPending}>
              Lưu 301
            </Button>
          </form>
        </Card>

        <Card className="overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-900">Lịch sử</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
          ) : data.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Chưa có redirect.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{r.fromPath}</p>
                    <p className="font-mono text-xs font-semibold text-slate-800">→ {r.toPath}</p>
                    {r.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600"
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
        </Card>
      </div>
    </AdminShell>
  );
}
