import {
  applyPublicVatCopy,
  commissionClosedNotice,
  payoutDayReminderNotice,
  publicVatSentence,
  shouldRemindPayoutDay,
  vatPercentOrEmpty,
  vietnamDateIso,
} from './commission-notices';

describe('commission notices', () => {
  it('đổi ngày theo giờ Việt Nam', () => {
    expect(vietnamDateIso(new Date('2026-10-31T16:59:59.000Z'))).toBe('2026-10-31');
    expect(vietnamDateIso(new Date('2026-10-31T17:00:00.000Z'))).toBe('2026-11-01');
  });

  it('báo tự chốt không nói đã trừ ví', () => {
    const notice = commissionClosedNotice('2026-09', 2);
    expect(notice.title).toBe('Đã tự chốt hoa hồng tháng 9/2026');
    expect(notice.body).toContain('Ví chưa trừ');
    expect(notice.link).toBe('/crm/finance/periods');
  });

  it('báo ngày chi không ra lệnh chuyển khoản', () => {
    const notice = payoutDayReminderNotice(10, 3);
    expect(notice.title).toContain('ngày 10');
    expect(notice.body).toContain('không chuyển khoản');
    expect(notice.link).toBe('/crm/finance/accounting');
  });

  it('chỉ nhắc đúng ngày chi, một lần, khi còn kỳ chờ', () => {
    const base = { todayIso: '2026-11-10', payoutDay: 10, remindedOn: null, payableCount: 2 };
    expect(shouldRemindPayoutDay(base)).toBe(true);
    expect(shouldRemindPayoutDay({ ...base, todayIso: '2026-11-09' })).toBe(false);
    expect(shouldRemindPayoutDay({ ...base, remindedOn: '2026-11-10' })).toBe(false);
    expect(shouldRemindPayoutDay({ ...base, payableCount: 0 })).toBe(false);
  });

  it('thuế suất để trống khi chưa đặt và không tự chọn 8 hay 10', () => {
    expect(vatPercentOrEmpty(null)).toBeNull();
    expect(vatPercentOrEmpty(undefined)).toBeNull();
    expect(vatPercentOrEmpty(8)).toBe(8);
    expect(vatPercentOrEmpty(10)).toBe(10);
    expect(vatPercentOrEmpty(101)).toBeNull();
    expect(vatPercentOrEmpty(-1)).toBeNull();
  });

  it('câu công khai dùng mức đã đặt và không giữ VAT 10% khi chưa đặt', () => {
    expect(publicVatSentence(null)).not.toContain('10%');
    expect(publicVatSentence(8)).toContain('VAT 8%');
    expect(applyPublicVatCopy('Giá hiển thị chưa bao gồm VAT 10%. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán.', 8)).toBe(
      publicVatSentence(8),
    );
    expect(applyPublicVatCopy('Có. Doanh nghiệp hỗ trợ xuất hoá đơn VAT.', 8)).toBe(
      'Có. Doanh nghiệp hỗ trợ xuất hoá đơn VAT.',
    );
  });
});
