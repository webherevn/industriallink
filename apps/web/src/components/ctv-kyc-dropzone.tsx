'use client';

import clsx from 'clsx';
import { ImageOff, Loader2, UploadCloud } from 'lucide-react';
import { useCallback, useRef, useState, type DragEvent } from 'react';

/** Định dạng & dung lượng được chấp nhận. */
export const KYC_ACCEPT = 'image/jpeg,image/png,image/webp';
export const KYC_MAX_BYTES = 5 * 1024 * 1024;

type DropzoneProps = {
  label: string;
  hint: string;
  /** URL ảnh đã tải (object URL) — null nếu chưa có. */
  previewUrl: string | null;
  /** true khi đã có ảnh trên server. */
  hasImage: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
};

/**
 * Ô kéo-thả ảnh CCCD. Chỉ nhận JPEG/PNG/WEBP tối đa 5MB.
 */
export function KycDropzone({
  label,
  hint,
  previewUrl,
  hasImage,
  disabled,
  onPick,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Ảnh phải là JPEG, PNG hoặc WEBP');
        return;
      }
      if (file.size > KYC_MAX_BYTES) {
        setError('Ảnh vượt quá 5MB');
        return;
      }
      setError(null);
      onPick(file);
    },
    [onPick],
  );

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition',
          dragging
            ? 'border-brand-400 bg-brand-50'
            : hasImage
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="max-h-40 w-full rounded-lg object-contain"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
            <UploadCloud className="h-5 w-5" />
          </span>
        )}
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="text-xs leading-snug text-slate-500">{hint}</span>
        {hasImage ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Đã tải lên — bấm để thay ảnh
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={KYC_ACCEPT}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Ô báo lỗi tải ảnh riêng (ảnh private cần token nên tải qua blob). */
export function KycImageFallback({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <ImageOff className="h-6 w-6 text-slate-400" />
      <p className="text-xs leading-snug text-slate-500">{message}</p>
    </div>
  );
}

/** Spinner dùng chung. */
export function KycSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
