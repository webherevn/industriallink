'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
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
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Cấu hình</p>
          <h1 className="cms-page-title mt-1.5">Robots.txt</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            Lưu bản custom hoặc khôi phục robots.txt mặc định của hệ thống.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/robots.txt"
            target="_blank"
            className="admin-dash-card inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-[#072348]"
          >
            Xem /robots.txt <ExternalLink className="h-3.5 w-3.5 text-[#E8872A]" />
          </Link>
          <button
            type="button"
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#072348] transition hover:border-[#FFD0A3] hover:bg-[#FFF8F1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {resetMutation.isPending ? 'Đang reset…' : 'Reset mặc định'}
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending || !content.trim() || isLoading}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Đã lưu robots.txt.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
          <div className="admin-dash-skel h-96" />
          <div className="admin-dash-skel h-40" />
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
          <div className="admin-dash-card admin-dash-rise space-y-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#072348]">Nội dung robots.txt</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isCustom
                    ? `Đang dùng bản custom${data?.updatedAt ? ` · cập nhật ${new Date(data.updatedAt).toLocaleString('vi-VN')}` : ''}`
                    : 'Đang dùng mặc định — chỉnh và Lưu để tạo bản custom.'}
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                  isCustom
                    ? 'bg-[#FFF8F1] text-[#072348] ring-[#FFD0A3]'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-100',
                )}
              >
                {isCustom ? 'Custom' : 'Default'}
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="cms-field-control min-h-[420px] rounded-2xl font-mono text-[12px] leading-relaxed"
              placeholder={'User-agent: *\nAllow: /\n…'}
            />

            <p className="text-[11px] text-slate-400">
              {content.length.toLocaleString('vi-VN')} ký tự
            </p>
          </div>

          <div className="admin-dash-card admin-dash-rise space-y-2 p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
            <p className="text-sm font-semibold text-[#072348]">Mặc định hệ thống</p>
            <pre className="max-h-48 overflow-auto rounded-2xl bg-[#f8fafc] p-4 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
              {data?.defaultContent}
            </pre>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
