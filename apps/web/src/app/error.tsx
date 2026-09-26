'use client';

import { useEffect } from 'react';
import { useChunkAutoReload } from '@/components/app-error-recovery';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = useChunkAutoReload(error);

  useEffect(() => {
    // Ghi log để tra cứu trên production.
    console.error('App error boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        {isChunk ? 'Đang cập nhật phiên bản mới…' : 'Đã có lỗi xảy ra'}
      </h1>
      <p className="max-w-md text-sm text-slate-500">
        {isChunk
          ? 'Trang vừa được cập nhật, đang tải lại tự động. Vui lòng đợi giây lát.'
          : 'Xin lỗi vì sự bất tiện. Bạn có thể thử lại hoặc tải lại trang.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Thử lại
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
}
