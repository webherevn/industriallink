import { channelCode, dayKey, parseDay, parseVnd, vndAccepted } from './marketing-input';

describe('marketing input', () => {
  it('nhận số nguyên VND và bỏ ô trống', () => {
    expect(parseVnd('1225000')).toBe(1225000n);
    expect(parseVnd('')).toBeNull();
    expect(parseVnd(null)).toBeNull();
    expect(vndAccepted('0')).toBe(true);
  });

  it('từ chối số lẻ, dấu phẩy và chuỗi quá dài', () => {
    expect(vndAccepted('12.5')).toBe(false);
    expect(vndAccepted('1,000')).toBe(false);
    expect(vndAccepted('-1')).toBe(false);
    expect(vndAccepted('1'.repeat(16))).toBe(false);
  });

  it('đọc ngày lịch và bác ngày không có thật', () => {
    expect(dayKey(parseDay('2026-10-17'))).toBe('2026-10-17');
    expect(parseDay('')).toBeNull();
    expect(parseDay('2026-02-31')).toBeUndefined();
  });

  it('đổi tên kênh thành mã ổn định', () => {
    expect(channelCode('Facebook Ads')).toBe('facebook-ads');
    expect(channelCode('Sự kiện HN')).toBe('su-kien-hn');
  });
});
