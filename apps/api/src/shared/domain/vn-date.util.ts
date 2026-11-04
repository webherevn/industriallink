/**
 * Tiện ích chuẩn hoá ngày dương lịch theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 *
 * Cột `@db.Date` trong PostgreSQL/Prisma chỉ lưu ngày dương lịch `YYYY-MM-DD`,
 * và được Prisma biểu diễn trong JS bằng `Date` tại mốc `YYYY-MM-DDT00:00:00.000Z`.
 * Mọi phép tính hạn nộp (`deadline`), trần hạn gói (`ceiling`), lọc tin còn hạn,
 * và đóng tin hết hạn (`JobExpiryService`) đều quy về mốc `YYYY-MM-DDT00:00:00.000Z`
 * của ngày dương lịch theo giờ Việt Nam để không lệch ngày trong khung 00:00–06:59 sáng giờ VN.
 */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const vnDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE });

/** Chuỗi `YYYY-MM-DD` theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`). */
export function vnDateString(date: Date = new Date()): string {
  return vnDateFormatter.format(date);
}

/**
 * Chuẩn hoá một `Date` hoặc chuỗi ngày/ISO về `Date` tại `YYYY-MM-DDT00:00:00.000Z`
 * tương ứng với ngày dương lịch tại Việt Nam (dùng cho cột `@db.Date`).
 *
 * - Nếu truyền chuỗi `'YYYY-MM-DD'` thuần: giữ nguyên ngày đó ở mốc `00:00:00.000Z`.
 * - Nếu truyền `Date` tại đúng `00:00:00.000Z` (giá trị đọc từ cột `@db.Date` của Prisma):
 *   giữ nguyên ngày UTC đó (`00:00:00.000Z` = `07:00:00` sáng cùng ngày giờ VN).
 * - Nếu truyền `Date` hoặc chuỗi ISO có giờ cụ thể: lấy ngày dương lịch theo giờ VN
 *   rồi đưa về mốc `YYYY-MM-DDT00:00:00.000Z`.
 */
export function toVnCalendarDate(input: Date | string): Date {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (ISO_DATE_ONLY_RE.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    const parsed = new Date(trimmed);
    const ymd = vnDateString(parsed);
    return new Date(`${ymd}T00:00:00.000Z`);
  }
  const ymd = vnDateString(input);
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Cộng `days` ngày dương lịch tính từ ngày Việt Nam của `from`,
 * trả về `Date` tại mốc `YYYY-MM-DDT00:00:00.000Z` (phù hợp cột `@db.Date`).
 */
export function addVnCalendarDays(from: Date, days: number): Date {
  const base = toVnCalendarDate(from);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/**
 * Kiểm tra hạn nộp `deadline` (cột `@db.Date`, là ngày cuối còn nhận hồ sơ theo giờ VN)
 * còn mở tại thời điểm `now` hay không.
 */
export function isVnDeadlineStillOpen(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return true;
  return toVnCalendarDate(deadline).getTime() >= toVnCalendarDate(now).getTime();
}
