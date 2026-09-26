'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CmsMediaItem } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { ApiError } from '@/lib/api';
import { deleteCmsMedia, listCmsMedia, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminCmsMediaPage() {
  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">CMS & SEO</p>
        <h1 className="cms-page-title mt-1.5">Thư viện media</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-xl">
          Ảnh đã tải cho bài viết, trang và danh mục. File mới được nén và lưu WebP.
        </p>
      </div>
      <CmsMediaGrid className="mt-6" />
    </AdminShell>
  );
}

export function CmsMediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#04162f]/45 p-4">
      <div className="admin-dash-card flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#072348]">Chọn từ thư viện</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-[#FFF8F1] hover:text-[#072348]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <CmsMediaGrid
            selectable
            onSelect={(item) => {
              onSelect(item.url);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CmsMediaGrid({
  selectable,
  onSelect,
  className,
}: {
  selectable?: boolean;
  onSelect?: (item: CmsMediaItem) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-media'],
    queryFn: listCmsMedia,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCmsMedia(file),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-media'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => deleteCmsMedia(filename),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-media'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Xoá thất bại'),
  });

  const items = data?.items ?? [];

  return (
    <div className={className}>
      <div className="admin-dash-card admin-dash-rise mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs text-slate-500">JPEG, PNG, WebP, GIF · tối đa 5MB · lưu WebP</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]">
            {isLoading ? '…' : items.length}
          </span>
          <button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? 'Đang tải…' : 'Tải ảnh mới'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) uploadMutation.mutate(file);
          }}
        />
      </div>
      {error ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="admin-dash-skel h-40" />
          <div className="admin-dash-skel h-40" />
          <div className="admin-dash-skel h-40" />
          <div className="admin-dash-skel h-40" />
        </div>
      ) : items.length === 0 ? (
        <div className="admin-dash-card px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
            <ImageIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#072348]">Chưa có ảnh nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => {
            const src = resolveCmsAssetUrl(item.url) || item.url;
            return (
              <div
                key={item.filename}
                className="admin-dash-card admin-dash-lift admin-dash-rise overflow-hidden"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <button
                  type="button"
                  className={clsx('block w-full bg-[#f8fafc]', selectable && 'cursor-pointer')}
                  disabled={!selectable}
                  onClick={() => onSelect?.(item)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-32 w-full object-cover" />
                </button>
                <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                  <span className="truncate text-[10px] font-medium text-slate-400">{formatSize(item.size)}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {selectable ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#E8872A]"
                        onClick={() => onSelect?.(item)}
                      >
                        Chọn
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-rose-600"
                      title="Xoá file"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Xoá ảnh này khỏi máy chủ? Bài viết đang dùng URL này sẽ mất ảnh.',
                          )
                        ) {
                          deleteMutation.mutate(item.filename);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
