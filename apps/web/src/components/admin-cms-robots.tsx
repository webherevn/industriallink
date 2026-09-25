'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  deleteCmsRobotsAdmin,
  getCmsRobotsAdmin,
  saveCmsRobotsAdmin,
} from '@/lib/admin-cms';

export function AdminRobotsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-robots'],
    queryFn: getCmsRobotsAdmin,
  });
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setContent(data.content);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveCmsRobotsAdmin({ content }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-robots'] });
      setContent(res.content);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  const resetMutation = useMutation({
    mutationFn: deleteCmsRobotsAdmin,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-robots'] });
      setContent(res.content);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Reset thất bại');
    },
  });

  const isCustom = data?.isCustom ?? false;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title">Robots.txt</h1>
          <p className="cms-page-subtitle">
            Chỉnh robots.txt kiểu RankMath — lưu bản custom hoặc reset về mặc định hệ thống.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/robots.txt"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-accent-200"
          >
            Xem /robots.txt <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={!isCustom || resetMutation.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  'Xoá bản custom và khôi phục robots.txt mặc định của hệ thống?',
                )
              ) {
                return;
              }
              resetMutation.mutate();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset mặc định
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={saveMutation.isPending || !content.trim() || isLoading}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã lưu robots.txt.
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="mt-5 mx-auto max-w-4xl space-y-4">
          <Card className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Nội dung robots.txt</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isCustom
                    ? `Đang dùng bản custom${data?.updatedAt ? ` · cập nhật ${new Date(data.updatedAt).toLocaleString('vi-VN')}` : ''}`
                    : 'Đang dùng mặc định — chỉnh và Lưu để tạo bản custom.'}
                </p>
              </div>
              <span
                className={
                  isCustom
                    ? 'rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100'
                    : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600'
                }
              >
                {isCustom ? 'Custom' : 'Default'}
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="cms-field-control min-h-[420px] font-mono text-[12px] leading-relaxed"
              placeholder="User-agent: *&#10;Allow: /&#10;…"
            />

            <p className="text-[11px] text-slate-400">
              {content.length.toLocaleString('vi-VN')} ký tự
            </p>
          </Card>

          <Card className="space-y-2 p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-900">Mặc định hệ thống (tham chiếu)</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              {data?.defaultContent}
            </pre>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
