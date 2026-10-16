/** Cookie tiếp thị liên kết. Mã cuối cùng được bấm, giữ 14 ngày. */
export const REFERRAL_COOKIE = 'il_ref';
export const REFERRAL_COOKIE_MS = 14 * 24 * 60 * 60 * 1000;
/** Nhà tuyển dụng. SuperAdmin bấm thử link không được tính hoa hồng. */
const PAYING_ROLES = new Set(['recruiter', 'hiring_manager', 'company_admin']);
const REFERRAL_CODE = /^CTV[0-9A-F]{4}$/;
const COOKIE_VALUE = /^(CTV[0-9A-F]{4})\.(\d+)$/;

export type ReferralStamp = { code: string; capturedAt: Date };

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? '';
  return REFERRAL_CODE.test(code) ? code : null;
}

/** Giá trị cookie: mã + thời điểm bấm, để chỉ tính tài khoản đăng ký sau lần bấm đó. */
export function formatReferralCookie(code: string, now = Date.now()): string {
  return `${code}.${now}`;
}

export function parseReferralCookie(raw: string | null | undefined, now = Date.now()): ReferralStamp | null {
  const match = COOKIE_VALUE.exec(raw?.trim().toUpperCase() ?? '');
  if (!match) return null;
  const capturedAt = new Date(Number(match[2]));
  if (!referralCapturedWithin(capturedAt.toISOString(), now)) return null;
  return { code: match[1], capturedAt };
}

/**
 * Hoa hồng cookie chỉ khi nhà tuyển dụng đăng ký sau lần bấm link
 * và thanh toán còn trong 14 ngày.
 */
export function referralForPayingAccount(input: {
  cookie: string | null | undefined;
  role: string;
  userCreatedAt: Date;
  now?: number;
}): ReferralStamp | null {
  if (!PAYING_ROLES.has(input.role)) return null;
  const stamp = parseReferralCookie(input.cookie, input.now);
  if (!stamp) return null;
  const skewMs = 60_000;
  if (input.userCreatedAt.getTime() + skewMs < stamp.capturedAt.getTime()) return null;
  return stamp;
}

export function referralCookieOptions(isProd: boolean, domain?: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: REFERRAL_COOKIE_MS,
    ...(domain ? { domain } : {}),
  };
}

export function referralCookieClearOptions(isProd: boolean, domain?: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function referralCapturedWithin(capturedAtIso: string, now = Date.now()): boolean {
  const at = Date.parse(capturedAtIso);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age <= REFERRAL_COOKIE_MS;
}

export function referralFromMetadata(metadata: unknown, now = Date.now()): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const row = metadata as { referralCode?: unknown; referralCapturedAt?: unknown };
  if (typeof row.referralCode !== 'string' || typeof row.referralCapturedAt !== 'string') return null;
  if (!referralCapturedWithin(row.referralCapturedAt, now)) return null;
  return normalizeReferralCode(row.referralCode);
}

export function mergeReferralMetadata(metadata: unknown, code: string, now = new Date()): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, referralCode: code, referralCapturedAt: now.toISOString() };
}
