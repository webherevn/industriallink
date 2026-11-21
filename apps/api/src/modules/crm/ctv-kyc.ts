/**
 * Logic thuần cho hồ sơ xác thực CCCD của cộng tác viên.
 * Không gọi DB, không gọi network. Dùng chung cho API và unit test.
 */

/** Ngưỡng khấu trừ thuế TNCN: từ 2.000.000đ/lần thì khấu trừ 10%. */
export const PIT_THRESHOLD_VND = 2_000_000n;

/** Thuế suất TNCN áp dụng cho khoản chi từ ngưỡng trở lên. */
export const PIT_PERCENT = 10;

/** Số ký tự của số CCCD (12 chữ số). */
export const ID_NUMBER_LENGTH = 12;

/** Số ngân hàng Việt Nam dùng cho khóa MST (mỗi CTV tối đa 30 mã). */
export const TAX_LOCK_LIMIT = 30;

/** Số ngày bảo vệ MST kể từ lúc khóa. */
export const TAX_LOCK_DAYS = 30;

/**
 * Bỏ dấu tiếng Việt, gộp khoảng trắng, viết thường.
 * Dùng để so khớp "Nguyễn Văn A" với "nguyen van a" / "NGUYEN VAN A".
 */
export function normalizeVietnameseName(raw: string | null | undefined): string {
  if (!raw) return '';
  const folded = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  return folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** true khi chuẩn hóa 2 chuỗi khớp nhau (bỏ qua khác biệt dấu/hoa thường/thừa khoảng trắng). */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeVietnameseName(a);
  const right = normalizeVietnameseName(b);
  if (!left || !right) return false;
  return left === right;
}

/** true khi chuỗi là số CCCD hợp lệ (12 chữ số). */
export function isValidIdNumber(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return new RegExp(`^\\d{${ID_NUMBER_LENGTH}}$`).test(raw.trim());
}

/** true khi mã số thuế hợp lệ (10 hoặc 13 chữ số). */
export function isValidTaxCode(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^\d{10}$|^\d{13}$/.test(raw.trim());
}

/**
 * Thuế TNCN khấu trừ trên một khoản chi trả cho cá nhân.
 * Dưới ngưỡng 2.000.000đ thì 0. Trên ngưỡng thì 10%, làm tròn xuống.
 */
export function pitTaxVnd(grossAmountVnd: bigint): bigint {
  if (grossAmountVnd <= 0n) return 0n;
  if (grossAmountVnd < PIT_THRESHOLD_VND) return 0n;
  return (grossAmountVnd * BigInt(PIT_PERCENT)) / 100n;
}

/** Thực nhận = tổng trước thuế - thuế TNCN. Không âm. */
export function netPaidVnd(grossAmountVnd: bigint): bigint {
  const tax = pitTaxVnd(grossAmountVnd);
  const net = grossAmountVnd - tax;
  return net > 0n ? net : 0n;
}

/** Hạn bảo vệ MST = thời điểm khóa + 30 ngày. */
export function taxLockExpiry(from: Date): Date {
  return new Date(from.getTime() + TAX_LOCK_DAYS * 24 * 60 * 60 * 1000);
}

/** Số ngày còn lại trước khi hết hạn bảo vệ. Tối thiểu 0. */
export function daysUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/** Trạng thái hiển thị của một khóa MST. */
export type TaxLockStatus = 'PROTECTING' | 'REGISTERED' | 'CONVERTED' | 'EXPIRED';

/**
 * Chuẩn hóa trạng thái khóa MST theo thời điểm hiện tại.
 * Hết hạn thì EXPIRED bất kể trạng thái ghi trước đó (trừ CONVERTED — đã phát sinh đơn thì giữ).
 */
export function resolveTaxLockStatus(
  status: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): TaxLockStatus {
  const raw = (status ?? 'PROTECTING').toUpperCase() as TaxLockStatus;
  if (raw === 'CONVERTED' || raw === 'REGISTERED') return raw;
  if (!expiresAt) return 'PROTECTING';
  if (expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'PROTECTING';
}

/** Danh sách ngân hàng Việt Nam cho dropdown. Mã = mã ngân hàng, tên = tên đầy đủ. */
export const CTV_BANKS: ReadonlyArray<{ code: string; name: string }> = [
  { code: '970436', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)' },
  { code: '970437', name: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)' },
  { code: '970438', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)' },
  { code: '970439', name: 'Ngân hàng TMCP Á Châu (ACB)' },
  { code: '970440', name: 'Ngân hàng TMCP Bưu điện Liên Việt (LienVietPostBank)' },
  { code: '970441', name: 'Ngân hàng TMCP Quân đội (MB)' },
  { code: '970442', name: 'Ngân hàng TMCP Đông Á (DongA Bank)' },
  { code: '970443', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)' },
  { code: '970444', name: 'Ngân hàng TMCP Bản Việt (BVBank)' },
  { code: '970445', name: 'Ngân hàng TMCP Xuất nhập khẩu Việt Nam (Eximbank)' },
  { code: '970446', name: 'Ngân hàng TMCP Phương Thượng (PTBank)' },
  { code: '970447', name: 'Ngân hàng TMCP Nam Á (NamABank)' },
  { code: '970448', name: 'Ngân hàng TMCP Đại Việt (DaiABank)' },
  { code: '970449', name: 'Ngân hàng TMCP Bắc Á (BacABank)' },
  { code: '970450', name: 'Ngân hàng TMCP Đông Nam Á (DongNamABank)' },
  { code: '970451', name: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)' },
  { code: '970452', name: 'Ngân hàng TMCP Tiên Giang (TienVang)' },
  { code: '970453', name: 'Ngân hàng TMCP An Bình (ABank)' },
  { code: '970454', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội - Phú Thọ (HDBank)' },
  { code: '970455', name: 'Ngân hàng TMCP Đại Việt - Đông Á (VPBank)' },
  { code: '970456', name: 'Ngân hàng TMCP Bảo Việt (BVBank)' },
  { code: '970457', name: 'Ngân hàng TMCP Đông Á (DAB)' },
  { code: '970458', name: 'Ngân hàng TMCP Kienlongbank' },
  { code: '970459', name: 'Ngân hàng TMCP Đông Nam (DNPBank)' },
];

/** Tìm tên ngân hàng theo mã. Trả null nếu không có trong danh sách. */
export function bankNameByCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const needle = code.trim().toUpperCase();
  return CTV_BANKS.find((bank) => bank.code === needle)?.name ?? null;
}

/**
 * Kiểm tra hồ sơ KYC có đủ điều kiện gửi duyệt không.
 * Trả về danh sách lỗi (rỗng = hợp lệ).
 */
export function validateKycSubmission(input: {
  fullName?: string | null;
  idNumber?: string | null;
  phone?: string | null;
  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  hasFrontImage: boolean;
  hasBackImage: boolean;
}): string[] {
  const errors: string[] = [];
  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.push('Họ và tên theo CCCD là bắt buộc');
  }
  if (!isValidIdNumber(input.idNumber)) {
    errors.push('Số CCCD phải đúng 12 chữ số');
  }
  if (!input.phone || input.phone.trim().length < 9) {
    errors.push('Số điện thoại không hợp lệ');
  }
  if (!input.hasFrontImage) errors.push('Cần ảnh mặt trước CCCD');
  if (!input.hasBackImage) errors.push('Cần ảnh mặt sau CCCD');
  if (!input.bankCode || input.bankCode.trim().length < 2) {
    errors.push('Mã ngân hàng là bắt buộc');
  }
  if (!input.bankAccountNumber || input.bankAccountNumber.trim().length < 6) {
    errors.push('Số tài khoản ngân hàng không hợp lệ');
  }
  if (!input.bankAccountHolder || input.bankAccountHolder.trim().length < 2) {
    errors.push('Tên chủ tài khoản là bắt buộc');
  }
  return errors;
}
