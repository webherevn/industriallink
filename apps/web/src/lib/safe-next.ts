/** Chỉ chấp nhận đường dẫn nội bộ, tránh open redirect. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

export function loginHref(next?: string | null): string {
  const dest = safeInternalPath(next);
  return dest ? `/login?next=${encodeURIComponent(dest)}` : '/login';
}

export function registerHref(next?: string | null): string {
  const dest = safeInternalPath(next);
  return dest ? `/register?next=${encodeURIComponent(dest)}` : '/register';
}
