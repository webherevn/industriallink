'use client';

import { useEffect } from 'react';
import { useChunkAutoReload } from '@/components/app-error-recovery';

/**
 * Bắt lỗi ở tầng root layout (khi các error boundary con không xử lý được).
 * global-error phải tự render <html>/<body> vì nó thay thế toàn bộ layout gốc,
 * nên dùng inline style thay cho Tailwind.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = useChunkAutoReload(error);

  useEffect(() => {
    console.error('Global error boundary:', error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '0 24px',
            textAlign: 'center',
            color: '#0f172a',
            background: '#f8fafc',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {isChunk ? 'Đang cập nhật phiên bản mới…' : 'Đã có lỗi xảy ra'}
          </h1>
          <p style={{ maxWidth: 420, fontSize: 14, color: '#64748b', margin: 0 }}>
            {isChunk
              ? 'Trang vừa được cập nhật, đang tải lại tự động. Vui lòng đợi giây lát.'
              : 'Xin lỗi vì sự bất tiện. Bạn có thể thử lại hoặc tải lại trang.'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: 6,
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                borderRadius: 6,
                background: '#fff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
