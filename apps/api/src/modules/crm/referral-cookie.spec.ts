import {
  formatReferralCookie,
  mergeReferralMetadata,
  normalizeReferralCode,
  parseReferralCookie,
  referralCapturedWithin,
  referralForPayingAccount,
  referralFromMetadata,
  REFERRAL_COOKIE_MS,
} from './referral-cookie';

describe('referral cookie', () => {
  it('chỉ nhận mã CTV đủ 4 ký tự hex', () => {
    expect(normalizeReferralCode(' ctvab12 ')).toBe('CTVAB12');
    expect(normalizeReferralCode('CTVZZZZ')).toBeNull();
    expect(normalizeReferralCode('CTV12')).toBeNull();
  });

  it('mã trên đơn còn hiệu lực trong 14 ngày', () => {
    const now = Date.parse('2026-10-16T00:00:00.000Z');
    const fresh = new Date(now - REFERRAL_COOKIE_MS + 1000).toISOString();
    const expired = new Date(now - REFERRAL_COOKIE_MS - 1).toISOString();
    expect(referralCapturedWithin(fresh, now)).toBe(true);
    expect(referralCapturedWithin(expired, now)).toBe(false);
    expect(referralFromMetadata({ referralCode: 'CTVAB12', referralCapturedAt: fresh }, now)).toBe('CTVAB12');
    expect(referralFromMetadata({ referralCode: 'CTVAB12', referralCapturedAt: expired }, now)).toBeNull();
  });

  it('ghi mã mới mà không xóa metadata khác', () => {
    const merged = mergeReferralMetadata({ note: 'giữ' }, 'CTVAB12', new Date('2026-10-16T00:00:00.000Z'));
    expect(merged.note).toBe('giữ');
    expect(merged.referralCode).toBe('CTVAB12');
    expect(merged.referralCapturedAt).toBe('2026-10-16T00:00:00.000Z');
  });

  it('chỉ tính nhà tuyển dụng đăng ký sau lần bấm link', () => {
    const clicked = Date.parse('2026-10-16T00:00:00.000Z');
    const cookie = formatReferralCookie('CTVAB12', clicked);
    const now = clicked + 60_000;
    expect(parseReferralCookie(cookie, now)?.code).toBe('CTVAB12');
    expect(parseReferralCookie('CTVAB12', now)).toBeNull();
    expect(
      referralForPayingAccount({
        cookie,
        role: 'recruiter',
        userCreatedAt: new Date(clicked + 5_000),
        now,
      })?.code,
    ).toBe('CTVAB12');
    expect(
      referralForPayingAccount({
        cookie,
        role: 'recruiter',
        userCreatedAt: new Date(clicked - 86_400_000),
        now,
      }),
    ).toBeNull();
    expect(
      referralForPayingAccount({
        cookie,
        role: 'super_admin',
        userCreatedAt: new Date(clicked + 5_000),
        now,
      }),
    ).toBeNull();
  });
});
