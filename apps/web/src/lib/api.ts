/** Production: same-origin `/api/v1` (aaPanel proxy → Nest). Dev: set NEXT_PUBLIC_API_URL. */
function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (raw) return `${raw}/api/v1`;
  return '/api/v1';
}

const API_BASE = apiBase();

const TOKEN_KEY = 'il_access_token';

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** true nếu gửi FormData (upload file). */
  isForm?: boolean;
  /** false để không tự thử refresh khi 401 (dùng cho chính endpoint refresh). */
  retryOnUnauthorized?: boolean;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    tokenStore.set(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, isForm = false, retryOnUnauthorized = true } = options;

  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retryOnUnauthorized) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? Array.isArray((payload as { message: unknown }).message)
          ? ((payload as { message: string[] }).message.join(', '))
          : String((payload as { message: unknown }).message)
        : `Lỗi ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return payload as T;
}
