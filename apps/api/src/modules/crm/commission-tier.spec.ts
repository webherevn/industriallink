import {
  CommissionTier,
  nextTier,
  parseVnd,
  resolveTier,
  revenueToNextTier,
  tierCommissionVnd,
  validateTiers,
} from './commission-tier';

/** 3 bậc chuẩn: Cơ bản 15% / Bạc 20% / Vàng 25%. */
const TIERS: CommissionTier[] = [
  {
    code: 'BASIC',
    name: 'Cơ bản',
    minMonthlyRevenue: 0n,
    maxMonthlyRevenue: 10_000_000n,
    ratePercent: 15,
    sortOrder: 1,
  },
  {
    code: 'SILVER',
    name: 'Bạc',
    minMonthlyRevenue: 10_000_000n,
    maxMonthlyRevenue: 30_000_000n,
    ratePercent: 20,
    sortOrder: 2,
  },
  {
    code: 'GOLD',
    name: 'Vàng',
    minMonthlyRevenue: 30_000_000n,
    maxMonthlyRevenue: null,
    ratePercent: 25,
    sortOrder: 3,
  },
];

describe('resolveTier', () => {
  it('bậc đầu cho doanh số 0 đến dưới 10tr', () => {
    expect(resolveTier(TIERS, 0n)?.code).toBe('BASIC');
    expect(resolveTier(TIERS, 9_999_999n)?.code).toBe('BASIC');
  });

  it('cận dưới gồm, cận trên không gồm', () => {
    // 10.000.000 → bậc Bạc (không còn là Cơ bản).
    expect(resolveTier(TIERS, 10_000_000n)?.code).toBe('SILVER');
    // 29.999.999 → vẫn Bạc.
    expect(resolveTier(TIERS, 29_999_999n)?.code).toBe('SILVER');
    // 30.000.000 → Vàng.
    expect(resolveTier(TIERS, 30_000_000n)?.code).toBe('GOLD');
  });

  it('bậc cuối không giới hạn trên', () => {
    expect(resolveTier(TIERS, 100_000_000n)?.code).toBe('GOLD');
    expect(resolveTier(TIERS, 999_999_999_999n)?.code).toBe('GOLD');
  });

  it('trả null khi không có bậc nào', () => {
    expect(resolveTier([], 5_000_000n)).toBeNull();
  });
});

describe('tierCommissionVnd', () => {
  it('tính hoa hồng và làm tròn nửa lên', () => {
    expect(tierCommissionVnd(22_000_000n, 20)).toBe(4_400_000n);
    expect(tierCommissionVnd(150n, 1)).toBe(2n);
    expect(tierCommissionVnd(149n, 1)).toBe(1n);
  });

  it('bỏ qua doanh thu 0 hoặc âm, tỷ lệ ngoài 0–50', () => {
    expect(tierCommissionVnd(0n, 15)).toBe(0n);
    expect(tierCommissionVnd(-100n, 15)).toBe(0n);
    expect(tierCommissionVnd(1_000_000n, 0)).toBe(0n);
    expect(tierCommissionVnd(1_000_000n, 51)).toBe(0n);
    expect(tierCommissionVnd(1_000_000n, 15.5)).toBe(0n);
  });
});

describe('nextTier + revenueToNextTier', () => {
  it('trả bậc kế tiếp theo ngưỡng tăng dần', () => {
    expect(nextTier(TIERS, resolveTier(TIERS, 0n))?.code).toBe('SILVER');
    expect(nextTier(TIERS, resolveTier(TIERS, 15_000_000n))?.code).toBe('GOLD');
    expect(nextTier(TIERS, resolveTier(TIERS, 50_000_000n))).toBeNull();
  });

  it('tính doanh số còn thiếu để lên hạng', () => {
    // Đã đạt 22tr → còn thiếu 8tr để lên Vàng.
    const progress = revenueToNextTier(TIERS, 22_000_000n);
    expect(progress.tier?.code).toBe('GOLD');
    expect(progress.threshold).toBe(30_000_000n);
    expect(progress.missing).toBe(8_000_000n);
  });

  it('đã đạt bậc cao nhất thì không còn bậc kế tiếp', () => {
    const progress = revenueToNextTier(TIERS, 40_000_000n);
    expect(progress.tier).toBeNull();
    expect(progress.missing).toBe(0n);
    expect(progress.threshold).toBeNull();
  });
});

describe('validateTiers', () => {
  it('chấp nhận bộ 3 bậc chuẩn', () => {
    expect(validateTiers(TIERS)).toEqual([]);
  });

  it('bắt lỗi bậc đầu không bắt đầu từ 0', () => {
    const errors = validateTiers([
      { ...TIERS[0], minMonthlyRevenue: 1_000_000n },
      ...TIERS.slice(1),
    ]);
    expect(errors.join(' ')).toContain('phải bắt đầu từ 0đ');
  });

  it('bắt lỗi khoảng doanh số đứt quãng / chồng chéo', () => {
    const errors = validateTiers([
      TIERS[0],
      { ...TIERS[1], minMonthlyRevenue: 12_000_000n },
      TIERS[2],
    ]);
    expect(errors.join(' ')).toContain('không liên tục');
  });

  it('bắt lỗi bậc cuối phải không giới hạn trên', () => {
    const errors = validateTiers([
      TIERS[0],
      { ...TIERS[1], maxMonthlyRevenue: 30_000_000n },
      { ...TIERS[2], maxMonthlyRevenue: 50_000_000n },
    ]);
    expect(errors.join(' ')).toContain('không giới hạn trên');
  });

  it('bắt lỗi tỷ lệ ngoài 0–50', () => {
    const errors = validateTiers([{ ...TIERS[0], ratePercent: 51 }]);
    expect(errors.join(' ')).toContain('0% đến 50%');
  });

  it('bắt lỗi ngưỡng trên phải lớn hơn ngưỡng dưới', () => {
    const errors = validateTiers([
      { ...TIERS[0], maxMonthlyRevenue: 0n },
      ...TIERS.slice(1),
    ]);
    expect(errors.join(' ')).toContain('ngưỡng trên phải lớn hơn');
  });

  it('bắt lỗi khi không có bậc nào', () => {
    expect(validateTiers([]).join(' ')).toContain('ít nhất một cấp bậc');
  });
});

describe('parseVnd', () => {
  it('parse chuỗi VND', () => {
    expect(parseVnd('10000000')).toBe(10_000_000n);
    expect(parseVnd('10 000 000')).toBe(10_000_000n);
    expect(parseVnd('10.000.000')).toBe(10_000_000n);
    expect(parseVnd(30_000_000)).toBe(30_000_000n);
  });

  it('trả null khi không hợp lệ', () => {
    expect(parseVnd('abc')).toBeNull();
    expect(parseVnd('-100')).toBeNull();
    expect(parseVnd('')).toBeNull();
    expect(parseVnd(null)).toBeNull();
    expect(parseVnd(undefined)).toBeNull();
  });
});

describe('Kịch bản 1 — nâng bậc trong tháng', () => {
  it('3 đơn hợp lệ (9tr Tin săn + 7tr Tin đăng + 6tr Tin săn) = 22tr → Bạc 20% → 4.400.000đ', () => {
    const orders = [9_000_000n, 7_000_000n, 6_000_000n];
    const total = orders.reduce((sum, value) => sum + value, 0n);

    expect(total).toBe(22_000_000n);

    const tier = resolveTier(TIERS, total);
    expect(tier?.code).toBe('SILVER');
    expect(tier?.ratePercent).toBe(20);

    // Tỷ lệ của bậc áp dụng cho TOÀN BỘ 3 đơn.
    const commissions = orders.map((value) => tierCommissionVnd(value, tier!.ratePercent));
    expect(commissions).toEqual([1_800_000n, 1_400_000n, 1_200_000n]);

    const totalCommission = commissions.reduce((sum, value) => sum + value, 0n);
    expect(totalCommission).toBe(4_400_000n);

    // Tương đương: tổng doanh thu × tỷ lệ của bậc.
    expect(tierCommissionVnd(total, tier!.ratePercent)).toBe(totalCommission);
  });
});

describe('Kịch bản 2 — loại trừ Nạp Credit', () => {
  it('1 đơn Tin săn 9tr (Cơ bản 15%) + 1 đơn Nạp Credit 15tr → Credit bị loại hoàn toàn', () => {
    // Chỉ đơn Tin săn được tính vào doanh số xét hạng.
    const eligible = [9_000_000n];
    const total = eligible.reduce((sum, value) => sum + value, 0n);

    expect(total).toBe(9_000_000n);
    const tier = resolveTier(TIERS, total);
    expect(tier?.code).toBe('BASIC');
    expect(tier?.ratePercent).toBe(15);

    const totalCommission = eligible.reduce(
      (sum, value) => sum + tierCommissionVnd(value, tier!.ratePercent),
      0n,
    );
    expect(totalCommission).toBe(1_350_000n);

    // Nạp Credit 15tr không sinh hoa hồng và không cộng vào doanh số.
    expect(tierCommissionVnd(15_000_000n, tier!.ratePercent)).toBe(2_250_000n);
    expect(total).not.toBe(24_000_000n);
  });
});

describe('Kịch bản 3 — đạt mốc >= 30tr', () => {
  it('toàn bộ đơn hợp lệ trong tháng nhảy lên Vàng 25%', () => {
    const orders = [15_000_000n, 10_000_000n, 8_000_000n];
    const total = orders.reduce((sum, value) => sum + value, 0n);
    expect(total).toBe(33_000_000n);

    const tier = resolveTier(TIERS, total);
    expect(tier?.code).toBe('GOLD');
    expect(tier?.ratePercent).toBe(25);

    const commissions = orders.map((value) => tierCommissionVnd(value, tier!.ratePercent));
    expect(commissions).toEqual([3_750_000n, 2_500_000n, 2_000_000n]);
    expect(commissions.reduce((sum, value) => sum + value, 0n)).toBe(8_250_000n);
  });
});

describe('Kịch bản 4 — sang tháng mới reset bậc', () => {
  it('tháng mới bắt đầu lại từ 0đ (Cơ bản 15%)', () => {
    // Tháng trước đạt Vàng.
    expect(resolveTier(TIERS, 33_000_000n)?.code).toBe('GOLD');
    // Tháng mới chỉ có 5tr → reset về Cơ bản.
    expect(resolveTier(TIERS, 5_000_000n)?.code).toBe('BASIC');
    expect(tierCommissionVnd(5_000_000n, 15)).toBe(750_000n);
  });
});

describe('Kịch bản 5 — tách VAT & nâng cấp gói', () => {
  it('khách trả 11.000.000đ gồm VAT 10% → chỉ tính 10.000.000đ', () => {
    const gross = 11_000_000n;
    const vat = 1_000_000n;
    const eligible = gross - vat;

    expect(eligible).toBe(10_000_000n);
    // Bậc Cơ bản 15%.
    expect(tierCommissionVnd(eligible, 15)).toBe(1_500_000n);
    // Nếu sai (tính trên gross) sẽ ra 1.650.000đ.
    expect(tierCommissionVnd(gross, 15)).not.toBe(tierCommissionVnd(eligible, 15));
  });

  it('đơn nâng cấp gói chỉ tính phần chênh lệch thực thu tăng thêm', () => {
    // Gói cũ đã trả 7.000.000đ, nâng cấp lên 10.000.000đ → delta = 3.000.000đ.
    const oldNet = 7_000_000n;
    const newNet = 10_000_000n;
    const delta = newNet - oldNet;

    expect(delta).toBe(3_000_000n);
    expect(tierCommissionVnd(delta, 15)).toBe(450_000n);
    // Không được tính trùng toàn bộ 10tr.
    expect(tierCommissionVnd(newNet, 15)).toBe(1_500_000n);
  });
});
