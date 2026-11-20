/**
 * Che mờ thông tin liên hệ của ứng viên — dùng chung cho mọi API trả hồ sơ.
 *
 * ⚠ QUY TẮC BẢO MẬT: khi ứng viên CHƯA được mở khóa (chưa trừ Credit và
 * chưa tự ứng tuyển), email/số điện thoại PHẢI bị mask NGAY TẠI BACKEND
 * để không lộ qua Network (F12) của trình duyệt.
 *
 * Khi đã mở khóa → trả nguyên bản 100%, KHÔNG mask và KHÔNG chờ ứng viên
 * chấp nhận yêu cầu kết nối.
 */

/** Che email: `nguyen.van.a@gmail.com` → `ng***@gmail.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

/** Che số điện thoại: `0987654538` → `098***538`. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-3)}`;
}
