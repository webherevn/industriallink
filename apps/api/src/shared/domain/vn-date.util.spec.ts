import {
  addVnCalendarDays,
  isVnDeadlineStillOpen,
  toVnCalendarDate,
  vnDateString,
} from './vn-date.util';

describe('vn-date.util', () => {
  it('vnDateString trả đúng ngày Việt Nam khi giờ UTC vẫn ở ngày hôm trước (00:00–06:59 sáng giờ VN)', () => {
    // 2026-08-30T23:30:00.000Z = 06:30 sáng ngày 2026-08-31 giờ Việt Nam
    const earlyMorningVn = new Date('2026-08-30T23:30:00.000Z');
    expect(vnDateString(earlyMorningVn)).toBe('2026-08-31');
  });

  it('toVnCalendarDate chuẩn hoá chuỗi YYYY-MM-DD và chuỗi ISO +07:00 về mốc 00:00:00.000Z của đúng ngày VN', () => {
    expect(toVnCalendarDate('2026-08-31').toISOString()).toBe('2026-08-31T00:00:00.000Z');
    // 00:00:00+07:00 là 2026-08-30T17:00:00.000Z nhưng ngày VN là 2026-08-31
    expect(toVnCalendarDate('2026-08-31T00:00:00+07:00').toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    );
    // Giá trị @db.Date từ Prisma (2026-08-31T00:00:00.000Z = 07:00 sáng 31/08 giờ VN) giữ nguyên 2026-08-31
    expect(toVnCalendarDate(new Date('2026-08-31T00:00:00.000Z')).toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    );
  });

  it('addVnCalendarDays cộng đúng số ngày theo lịch Việt Nam kể cả lúc 01:00 sáng giờ VN', () => {
    // 2026-08-31T18:00:00.000Z = 01:00 sáng ngày 2026-09-01 giờ VN
    const oneAmVnSept1 = new Date('2026-08-31T18:00:00.000Z');
    expect(addVnCalendarDays(oneAmVnSept1, 14).toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('isVnDeadlineStillOpen giữ tin mở đến hết 23:59:59 giờ VN của ngày deadline và đóng từ 00:00:00 ngày hôm sau', () => {
    const deadline = new Date('2026-08-31T00:00:00.000Z'); // Hạn ngày 31/08

    // 23:59:59 ngày 31/08 giờ VN = 2026-08-31T16:59:59.000Z → vẫn còn hạn
    expect(isVnDeadlineStillOpen(deadline, new Date('2026-08-31T16:59:59.000Z'))).toBe(true);

    // 00:00:00 ngày 01/09 giờ VN = 2026-08-31T17:00:00.000Z → đã qua hạn
    expect(isVnDeadlineStillOpen(deadline, new Date('2026-08-31T17:00:00.000Z'))).toBe(false);
  });
});
