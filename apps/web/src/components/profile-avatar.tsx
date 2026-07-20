'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchMyAvatarObjectUrl, uploadAvatar } from '@/lib/candidate';
import { gravatarUrl } from '@/lib/gravatar';

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
 * Nút camera mở chọn file để upload.
 */
export function ProfileAvatar({
  displayName,
  email,
  hasAvatar,
  size = 'lg',
}: {
  displayName: string;
  email: string | null | undefined;
  hasAvatar: boolean;
  size?: 'md' | 'lg';
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const dim = size === 'lg' ? 'h-[88px] w-[88px] sm:h-[100px] sm:w-[100px] text-2xl' : 'h-14 w-14 text-sm';

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setErrorMsg(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (hasAvatar) {
        const url = await fetchMyAvatarObjectUrl();
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          objectUrlRef.current = url;
          setSrc(url);
          setLoading(false);
          return;
        }
      }

      if (email) {
        const gUrl = await gravatarUrl(email, 200);
        if (!cancelled) {
          setSrc(gUrl);
          setLoading(false);
          return;
        }
      }

      if (!cancelled) {
        setSrc(null);
        setLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [hasAvatar, email]);

  const mutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-candidate'] });
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Không tải được ảnh');
    },
  });

  function onPick(file: File | undefined) {
    if (!file) return;
    mutation.mutate(file);
  }

  return (
    <div className="relative shrink-0">
      <div
        className={clsx(
          'flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 via-sky-500 to-amber-400 font-bold text-white shadow-lg ring-4 ring-amber-50',
          dim,
        )}
      >
        {loading || mutation.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-white/90" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => setSrc(null)}
          />
        ) : (
          initials(displayName)
        )}
      </div>

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
    </div>
  );
}
