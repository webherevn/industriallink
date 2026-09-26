'use client';

import { useEffect } from 'react';

/**
 * Nhận diện lỗi tải chunk JS. Thường xảy ra ngay sau khi deploy phiên bản mới:
 * HTML/JS cũ trong cache của trình duyệt trỏ tới file chunk đã bị đổi tên → tải lỗi.
 */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk\s+[\w-]+\s+failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  return (
    err?.name === 'ChunkLoadError' ||
    CHUNK_ERROR_RE.test(err?.message ?? '') ||
    CHUNK_ERROR_RE.test(String(error))
  );
}

const RELOAD_GUARD_KEY = 'il_chunk_reloaded_at';
const RELOAD_GUARD_MS = 10_000;

/**
 * Tự tải lại trang 1 lần khi gặp lỗi chunk (lấy HTML + chunk mới nhất).
 * Có guard theo thời gian trong sessionStorage để tránh vòng lặp reload vô hạn
 * (nếu lỗi không phải do chunk cũ mà là lỗi thật, sẽ không reload liên tục).
 * Trả về true nếu lỗi hiện tại là lỗi chunk.
 */
export function useChunkAutoReload(error: unknown): boolean {
  const isChunk = isChunkLoadError(error);
  useEffect(() => {
    if (!isChunk) return;
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
      if (now - last > RELOAD_GUARD_MS) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [isChunk]);
  return isChunk;
}
