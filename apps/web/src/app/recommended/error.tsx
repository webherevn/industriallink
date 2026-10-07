'use client';

export default function RecommendedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>500 - Lỗi server khi tải trang /recommended</h1>
      <pre style={{ background: '#f3f4f6', padding: 16, overflow: 'auto' }}>
        {error.message}
      </pre>
      {error.digest ? <p>Digest: {error.digest}</p> : null}
      <button onClick={reset}>Thử lại</button>
    </div>
  );
}