'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchMyAvatarObjectUrl, uploadAvatar } from '@/lib/candidate';
import { gravatarUrl } from '@/lib/gravatar';

export const MY_AVATAR_QUERY_KEY = ['my-avatar'] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

/**
 * Ảnh hồ sơ: ưu tiên ảnh tải lên → Gravatar (email) → chữ viết tắt.
 * Dùng chung query `my-avatar` để header / dashboard đồng bộ sau khi upload.
 */
export function ProfileAvatar({
  displayName,
  email,
  hasAvatar,
  size = 'lg',
  editable = true,
  className,
}: {
  displayName: string;
  email: string | null | undefined;
  hasAvatar: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** false = chỉ hiển thị (header menu). */
  editable?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [gravatarSrc, setGravatarSrc] = useState<string | null>(null);
  const [gravatarLoading, setGravatarLoading] = useState(false);
  const [brokenUpload, setBrokenUpload] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dim =
    size === 'sm'
      ? 'h-8 w-8 text-[11px]'
      : size === 'md'
        ? 'h-14 w-14 text-sm'
        : 'h-[88px] w-[88px] sm:h-[100px] sm:w-[100px] text-2xl';

  const ring =
    size === 'sm'
      ? 'shadow-sm ring-0'
      : 'shadow-lg ring-4 ring-amber-50';

  const uploaded = useQuery({
    queryKey: MY_AVATAR_QUERY_KEY,
    queryFn: async () => {
      const prev = queryClient.getQueryData<string | null>(MY_AVATAR_QUERY_KEY);
      if (prev) URL.revokeObjectURL(prev);
      return fetchMyAvatarObjectUrl();
    },
    enabled: hasAvatar,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  useEffect(() => {
    setBrokenUpload(false);
  }, [uploaded.dataUpdatedAt, hasAvatar]);

  useEffect(() => {
    let cancelled = false;
    if (hasAvatar && uploaded.data && !brokenUpload) {
      setGravatarSrc(null);
      setGravatarLoading(false);
      return;
    }
    if (!email) {
      setGravatarSrc(null);
      setGravatarLoading(false);
      return;
    }
    setGravatarLoading(true);
    void gravatarUrl(email, size === 'sm' ? 64 : 200).then((gUrl) => {
      if (!cancelled) {
        setGravatarSrc(gUrl);
        setGravatarLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasAvatar, email, size, uploaded.data, brokenUpload]);

  const mutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      setErrorMsg(null);
      setBrokenUpload(false);
      await queryClient.invalidateQueries({ queryKey: ['my-candidate'] });
      await queryClient.invalidateQueries({ queryKey: MY_AVATAR_QUERY_KEY });
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Không tải được ảnh');
    },
  });

  function onPick(file: File | undefined) {
    if (!file) return;
    mutation.mutate(file);
  }

  const src =
    hasAvatar && uploaded.data && !brokenUpload
      ? uploaded.data
      : gravatarSrc;

  const loading =
    mutation.isPending ||
    (hasAvatar && uploaded.isLoading) ||
    (!hasAvatar && gravatarLoading) ||
    (hasAvatar && brokenUpload && gravatarLoading);

  return (
    <div className={clsx('relative shrink-0', className)}>
      <div
        className={clsx(
          'flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 via-sky-500 to-amber-400 font-bold text-white',
          dim,
          ring,
        )}
      >
        {loading ? (
          <Loader2
            className={clsx(
              'animate-spin text-white/90',
              size === 'sm' ? 'h-3.5 w-3.5' : 'h-6 w-6',
            )}
          />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => {
              if (hasAvatar && uploaded.data && !brokenUpload) {
                setBrokenUpload(true);
              } else {
                setGravatarSrc(null);
              }
            }}
          />
        ) : (
          initials(displayName)
        )}
      </div>

      {editable && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={mutation.isPending}
            className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-md ring-2 ring-white transition hover:bg-brand-600 hover:scale-105 disabled:opacity-60"
            title="Tải ảnh đại diện (hoặc dùng Gravatar theo email)"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {errorMsg && (
            <p className="absolute left-1/2 top-full z-10 mt-1 w-44 -translate-x-1/2 rounded-lg bg-rose-50 px-2 py-1 text-center text-[10px] font-medium text-rose-600 ring-1 ring-rose-100">
              {errorMsg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
