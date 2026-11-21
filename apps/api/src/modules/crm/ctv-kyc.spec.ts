import {
  CTV_BANKS,
  PIT_THRESHOLD_VND,
  bankNameByCode,
  daysUntilExpiry,
  isValidIdNumber,
  isValidTaxCode,
  namesMatch,
  netPaidVnd,
  normalizeVietnameseName,
  pitTaxVnd,
  resolveTaxLockStatus,
  taxLockExpiry,
  validateKycSubmission,
} from './ctv-kyc';

describe('chuẩn hóa tên tiếng Việt', () => {
  it('bỏ dấu và viết thường', () => {
    expect(normalizeVietnameseName('Nguyễn Văn A')).toBe('nguyen van a');
  });

  it('giữ chữ đ và Đ', () => {
    expect(normalizeVietnameseName('Đặng Thị Đ')).toBe('dang thi d');
  });

  it('gộp khoảng trắng thừa và bỏ ký tự lạ', () => {
    expect(normalizeVietnameseName('  Nguyễn   Văn  ,  A! ')).toBe('nguyen van a');
  });

  it('khớp dù khác hoa thường và dấu', () => {
    expect(namesMatch('Nguyễn Văn A', 'nguyen van a')).toBe(true);
    expect(namesMatch('Nguyễn Văn A', 'NGUYEN VAN A')).toBe(true);
  });

  it('không khớp khi tên khác nhau', () => {
    expect(namesMatch('Nguyễn Văn A', 'Nguyễn Văn B')).toBe(false);
  });

  it('không khớp khi một bên rỗng', () => {
    expect(namesMatch('Nguyễn Văn A', '')).toBe(false);
    expect(namesMatch(null, 'Nguyễn Văn A')).toBe(false);
  });
});

describe('kiểm tra số CCCD', () => {
  it('chấp nhận đúng 12 chữ số', () => {
    expect(isValidIdNumber('001203012345')).toBe(true);
  });

  it('từ chối sai độ dài hoặc có chữ', () => {
    expect(isValidIdNumber('00120301234')).toBe(false);
    expect(isValidIdNumber('0012030123456')).toBe(false);
    expect(isValidIdNumber('00120301234a')).toBe(false);
    expect(isValidIdNumber('')).toBe(false);
    expect(isValidIdNumber(null)).toBe(false);
  });
});

describe('kiểm tra mã số thuế', () => {
  it('chấp nhận 10 hoặc 13 chữ số', () => {
    expect(isValidTaxCode('0312034567')).toBe(true);
    expect(isValidTaxCode('0312034567891')).toBe(true);
  });

  it('từ chối độ dài khác', () => {
    expect(isValidTaxCode('031203456')).toBe(false);
    expect(isValidTaxCode('03120345678912')).toBe(false);
  });
});

describe('thuế TNCN và thực nhận', () => {
  it('dưới ngưỡng 2 triệu thì không khấu trừ thuế', () => {
    expect(pitTaxVnd(1_999_999n)).toBe(0n);
    expect(netPaidVnd(1_999_999n)).toBe(1_999_999n);
  });

  it('từ ngưỡng 2 triệu trở lên thì khấu trừ 10%', () => {
    expect(pitTaxVnd(PIT_THRESHOLD_VND)).toBe(200_000n);
    expect(netPaidVnd(PIT_THRESHOLD_VND)).toBe(1_800_000n);
  });

  it('làm tròn xuống phần thuế', () => {
    // 1_999_999 + 1 = 2_000_000 -> thuế 200_000
    expect(pitTaxVnd(2_000_001n)).toBe(200_000n);
    // 3_333_333 * 10% = 333_333.3 -> 333_333
    expect(pitTaxVnd(3_333_333n)).toBe(333_333n);
  });

  it('số 0 hoặc âm thì thuế 0', () => {
    expect(pitTaxVnd(0n)).toBe(0n);
    expect(pitTaxVnd(-100n)).toBe(0n);
  });
});

describe('khóa MST', () => {
  it('hạn bảo vệ = khóa + 30 ngày', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(taxLockExpiry(from).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('đếm số ngày còn lại, không âm', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(daysUntilExpiry(new Date('2026-01-11T00:00:00.000Z'), now)).toBe(10);
    expect(daysUntilExpiry(new Date('2025-12-01T00:00:00.000Z'), now)).toBe(0);
  });

  it('hết hạn thì EXPIRED, đã đăng ký hoặc đã có đơn thì giữ', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const past = new Date('2026-05-01T00:00:00.000Z');
    const future = new Date('2026-07-01T00:00:00.000Z');
    expect(resolveTaxLockStatus('PROTECTING', past, now)).toBe('EXPIRED');
    expect(resolveTaxLockStatus('PROTECTING', future, now)).toBe('PROTECTING');
    expect(resolveTaxLockStatus('REGISTERED', past, now)).toBe('REGISTERED');
    expect(resolveTaxLockStatus('CONVERTED', past, now)).toBe('CONVERTED');
    expect(resolveTaxLockStatus(null, future, now)).toBe('PROTECTING');
  });
});

describe('danh sách ngân hàng', () => {
  it('có mã ngân hàng và tìm được tên theo mã', () => {
    expect(CTV_BANKS.length).toBeGreaterThan(10);
    expect(bankNameByCode('970436')).toContain('Vietcombank');
  });

  it('trả null khi mã không có trong danh sách', () => {
    expect(bankNameByCode('000000')).toBeNull();
    expect(bankNameByCode(null)).toBeNull();
  });
});

describe('validate hồ sơ KYC', () => {
  const valid = {
    fullName: 'Nguyễn Văn A',
    idNumber: '001203012345',
    phone: '0987654321',
    bankCode: 'VCB',
    bankAccountNumber: '0123456789',
    bankAccountHolder: 'Nguyễn Văn A',
    hasFrontImage: true,
    hasBackImage: true,
  };

  it('hồ sơ đầy đủ thì không có lỗi', () => {
    expect(validateKycSubmission(valid)).toEqual([]);
  });

  it('thiếu ảnh mặt sau thì báo lỗi', () => {
    const errors = validateKycSubmission({ ...valid, hasBackImage: false });
    expect(errors).toContain('Cần ảnh mặt sau CCCD');
  });

  it('thiếu ảnh mặt trước thì báo lỗi', () => {
    const errors = validateKycSubmission({ ...valid, hasFrontImage: false });
    expect(errors).toContain('Cần ảnh mặt trước CCCD');
  });

  it('số CCCD sai 12 chữ số thì báo lỗi', () => {
    const errors = validateKycSubmission({ ...valid, idNumber: '12345' });
    expect(errors).toContain('Số CCCD phải đúng 12 chữ số');
  });

  it('thiếu số tài khoản ngân hàng thì báo lỗi', () => {
    const errors = validateKycSubmission({ ...valid, bankAccountNumber: '' });
    expect(errors).toContain('Số tài khoản ngân hàng không hợp lệ');
    expect(errors).not.toContain('Tên chủ tài khoản là bắt buộc');
  });

  it('thiếu tên chủ tài khoản thì báo lỗi', () => {
    const errors = validateKycSubmission({ ...valid, bankAccountHolder: '' });
    expect(errors).toContain('Tên chủ tài khoản là bắt buộc');
  });
});
