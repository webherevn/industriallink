'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CmsMediaItem } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
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
      <div>
        <h1 className="cms-page-title flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-brand-600" />
          Thư viện media
        </h1>
        <p className="cms-page-subtitle">
          Ảnh đã tải cho bài viết, trang, danh mục. File mới được nén và lưu WebP. Chọn lại khi soạn, hoặc xoá file không dùng.
        </p>
      </div>
      <CmsMediaGrid className="mt-5" />
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Chọn từ thư viện</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {items.length} ảnh · JPEG, PNG, WebP, GIF · tối đa 5MB · lưu WebP
        </p>
        <Button
          type="button"
          variant="outline"
          className="py-2 text-xs"
          disabled={uploadMutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadMutation.isPending ? 'Đang tải…' : 'Tải ảnh mới'}
        </Button>
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
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải thư viện…</p>
      ) : items.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">Chưa có ảnh nào.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const src = resolveCmsAssetUrl(item.url) || item.url;
            return (
              <div key={item.filename} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                <button
                  type="button"
                  className="block w-full bg-slate-50"
                  disabled={!selectable}
                  onClick={() => onSelect?.(item)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-28 w-full object-cover" />
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-[10px] text-slate-400">{formatSize(item.size)}</span>
                  <div className="flex shrink-0 gap-1">
                    {selectable ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-brand-600"
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
