/**
 * Ma trận tiêu chí AI đánh giá ứng viên Sales B2B công nghiệp VN.
 * Tổng trọng số = 100% (A 75% + B 12% + C 13%).
 *
 * Nguồn: bảng tiêu chí chấm điểm IndustrialLink (18 tiêu chí).
 * “Năng lực bán hàng toàn chu trình” = AI suy từ checklist giai đoạn bán,
 * không hỏi ứng viên tự đánh giá.
 */

import { INDUSTRY_GROUPS, type IndustryGroup } from './job-taxonomy';

// ---------------------------------------------------------------------------
// A. NĂNG LỰC LÕI (75%)
// ---------------------------------------------------------------------------

/** 1. Ngành công nghiệp có kinh nghiệm (12%). */
export const SALES_INDUSTRY_OPTIONS: readonly IndustryGroup[] = INDUSTRY_GROUPS.filter(
  (g) => g !== 'Khác',
);

/** 2. Sản phẩm / giải pháp từng bán (11%). */
export const PRODUCTS_SOLD = [
  'Máy nén khí',
  'Máy phát điện',
  'Máy bơm',
  'Máy công cụ / CNC',
  'Chiller / Điều hòa công nghiệp',
  'Tháp giải nhiệt',
  'PLC / Tự động hóa',
  'SCADA / HMI',
  'Robot công nghiệp',
  'Biến tần / Servo',
  'Tủ điện / UPS',
  'Vòng bi / Vật tư bảo trì (MRO)',
  'Van / Phớt / Dây curoa',
  'Hệ thống khí nén',
  'Thủy lực',
  'Dầu nhớt công nghiệp',
  'Hóa chất bảo trì',
  'Thiết bị đo lường',
  'Xe nâng / Kho vận',
  'Băng tải / Xe tự hành (AGV)',
  'Giải pháp EPC / Cơ điện',
  'Khác',
] as const;

export type ProductSold = (typeof PRODUCTS_SOLD)[number];

/** 3. Tệp khách hàng từng bán (11%). */
export const CUSTOMER_SEGMENTS = [
  'Nhà máy FDI',
  'Nhà máy Việt Nam',
  'Nhà thầu cơ điện / EPC',
  'Nhà sản xuất OEM',
  'Đại lý / Nhà phân phối',
  'Doanh nghiệp vừa và nhỏ',
  'Tập đoàn / Tổng thầu',
  'Khác',
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/**
 * 4. Thành tích kinh doanh (10%) — % KPI gần nhất.
 * 5. Phát triển KH mới (8%) — tỷ lệ khách tự phát triển.
 */
export const KPI_ACHIEVEMENT_BANDS = [
  { value: 'under_70', label: '< 70%', midPct: 60 },
  { value: '70_89', label: '70 – 89%', midPct: 80 },
  { value: '90_99', label: '90 – 99%', midPct: 95 },
  { value: '100_119', label: '100 – 119%', midPct: 110 },
  { value: '120_plus', label: '≥ 120%', midPct: 130 },
] as const;

export type KpiAchievementBand = (typeof KPI_ACHIEVEMENT_BANDS)[number]['value'];

export const NEW_CUSTOMER_RATIO_BANDS = [
  { value: '0_20', label: '0 – 20%', midPct: 10 },
  { value: '21_40', label: '21 – 40%', midPct: 30 },
  { value: '41_60', label: '41 – 60%', midPct: 50 },
  { value: '61_80', label: '61 – 80%', midPct: 70 },
  { value: '80_plus', label: '> 80%', midPct: 90 },
] as const;

export type NewCustomerRatioBand = (typeof NEW_CUSTOMER_RATIO_BANDS)[number]['value'];

/** 5 / 15. Phong cách phát triển KH / Sales Persona. */
export enum CustomerDevStyle {
  Hunter = 'hunter',
  Hybrid = 'hybrid',
  Farmer = 'farmer',
}

export const CUSTOMER_DEV_STYLE_LABEL: Record<CustomerDevStyle, string> = {
  [CustomerDevStyle.Hunter]: 'Chuyên tìm khách mới (Hunter)',
  [CustomerDevStyle.Hybrid]: 'Cả khách mới và khách cũ (Hybrid)',
  [CustomerDevStyle.Farmer]: 'Chăm sóc khách hiện hữu (Farmer)',
};

/** 6. Kinh nghiệm Sales B2B (7%). */
export enum B2bExperienceBand {
  Under1 = 'under_1',
  From1To3 = '1_3',
  From3To5 = '3_5',
  From5To10 = '5_10',
  Over10 = '10_plus',
}

export const B2B_EXPERIENCE_BAND_LABEL: Record<B2bExperienceBand, string> = {
  [B2bExperienceBand.Under1]: '< 1 năm',
  [B2bExperienceBand.From1To3]: '1 – 3 năm',
  [B2bExperienceBand.From3To5]: '3 – 5 năm',
  [B2bExperienceBand.From5To10]: '5 – 10 năm',
  [B2bExperienceBand.Over10]: '> 10 năm',
};

/**
 * 7. Năng lực bán hàng toàn chu trình (7%).
 * AI suy từ checklist — không hỏi “bạn giỏi không”.
 * Thứ tự cố định theo luồng bán hàng IndustrialLink.
 */
export const SELLING_STAGES = [
  'Tìm kiếm khách hàng',
  'Tiếp cận',
  'Xác định nhu cầu',
  'Khảo sát',
  'Tư vấn sản phẩm',
  'Xây dựng giải pháp',
  'Báo giá',
  'Thuyết trình',
  'Đàm phán',
  'Chốt hợp đồng',
  'Triển khai/giao hàng',
  'Thu hồi công nợ',
  'Chăm sóc/bán thêm',
] as const;

export type SellingStage = (typeof SELLING_STAGES)[number];

/** Alias cũ → stage mới (CV parse / dữ liệu cũ). */
export const LEGACY_SELLING_STAGE_MAP: Record<string, SellingStage> = {
  'Tìm khách tiềm năng': 'Tìm kiếm khách hàng',
  'Khảo sát hiện trường': 'Khảo sát',
  'Tư vấn kỹ thuật': 'Tư vấn sản phẩm',
  'Chốt đơn': 'Chốt hợp đồng',
  'Bán thêm/bán chéo': 'Chăm sóc/bán thêm',
  'Theo dõi triển khai': 'Triển khai/giao hàng',
  'Chăm sóc sau bán': 'Chăm sóc/bán thêm',
};

export function normalizeSellingStage(raw: string): SellingStage | null {
  const trimmed = raw.trim();
  if ((SELLING_STAGES as readonly string[]).includes(trimmed)) {
    return trimmed as SellingStage;
  }
  return LEGACY_SELLING_STAGE_MAP[trimmed] ?? null;
}

/** 8. Loại hình & quy mô thương vụ (5%). */
export enum DealType {
  /** Bán sản phẩm / tiêu chuẩn */
  Standard = 'standard',
  Solution = 'solution',
  Project = 'project',
}

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  [DealType.Standard]: 'Bán sản phẩm / tiêu chuẩn',
  [DealType.Solution]: 'Bán giải pháp',
  [DealType.Project]: 'Bán dự án',
};

export const DEAL_VALUE_BANDS = [
  { value: 'under_50m', label: '< 50 triệu', midVnd: 25_000_000 },
  { value: '50_200m', label: '50 – 200 triệu', midVnd: 125_000_000 },
  { value: '200_500m', label: '200 – 500 triệu', midVnd: 350_000_000 },
  { value: '0_5_2b', label: '0,5 – 2 tỷ', midVnd: 1_250_000_000 },
  { value: '2_10b', label: '2 – 10 tỷ', midVnd: 6_000_000_000 },
  { value: '10b_plus', label: '> 10 tỷ', midVnd: 15_000_000_000 },
] as const;

export type DealValueBand = (typeof DEAL_VALUE_BANDS)[number]['value'];

/** 9. Khu vực / thị trường từng phụ trách (4%). */
export const MARKET_REGIONS = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Bắc Ninh / Bắc Giang',
  'Đồng Nai / Bình Dương',
  'Long An / Tây Nam Bộ',
  'Miền Bắc',
  'Miền Trung',
  'Miền Nam',
  'KCN toàn quốc',
  'Khách hàng FDI',
  'Khách hàng trong nước',
  'Xuất khẩu / Quốc tế',
] as const;

export type MarketRegion = (typeof MARKET_REGIONS)[number];

// ---------------------------------------------------------------------------
// B. ĐIỀU KIỆN CÔNG VIỆC (12%)
// ---------------------------------------------------------------------------

/**
 * 10. Sẵn sàng chuyển việc / thời gian nhận việc (4%).
 * Tách: mức sẵn sàng + band ngày nhận việc.
 */
export enum JobReadiness {
  Active = 'active',
  Open = 'open',
  SoftOpen = 'soft_open',
  Passive = 'passive',
}

export const JOB_READINESS_LABEL: Record<JobReadiness, string> = {
  [JobReadiness.Active]: 'Đang tích cực tìm',
  [JobReadiness.Open]: 'Sẵn sàng nghe cơ hội',
  [JobReadiness.SoftOpen]: 'Chưa chủ động nhưng có thể trao đổi',
  [JobReadiness.Passive]: 'Chưa có nhu cầu',
};

export enum AvailabilityBand {
  Immediate = 'immediate',
  Under15 = 'under_15',
  Under30 = 'under_30',
  Days30To60 = '30_60',
  Over60 = 'over_60',
}

export const AVAILABILITY_BAND_LABEL: Record<AvailabilityBand, string> = {
  [AvailabilityBand.Immediate]: 'Ngay',
  [AvailabilityBand.Under15]: '< 15 ngày',
  [AvailabilityBand.Under30]: '< 30 ngày',
  [AvailabilityBand.Days30To60]: '30 – 60 ngày',
  [AvailabilityBand.Over60]: '> 60 ngày',
};

export function availabilityToNoticeDays(band: AvailabilityBand | string | null | undefined): number | null {
  switch (band) {
    case AvailabilityBand.Immediate:
      return 0;
    case AvailabilityBand.Under15:
      return 15;
    case AvailabilityBand.Under30:
      return 30;
    case AvailabilityBand.Days30To60:
      return 45;
    case AvailabilityBand.Over60:
      return 75;
    default:
      return null;
  }
}

export function noticeDaysToAvailability(days: number | null | undefined): AvailabilityBand | null {
  if (days == null || !Number.isFinite(days)) return null;
  if (days <= 0) return AvailabilityBand.Immediate;
  if (days <= 15) return AvailabilityBand.Under15;
  if (days <= 30) return AvailabilityBand.Under30;
  if (days <= 60) return AvailabilityBand.Days30To60;
  return AvailabilityBand.Over60;
}

/** 11. Ngoại ngữ (3%). */
export const LANGUAGE_OPTIONS = [
  'Tiếng Anh giao tiếp',
  'Tiếng Anh thương mại',
  'Tiếng Trung',
  'Tiếng Nhật',
  'Tiếng Hàn',
  'Khác',
] as const;

export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export const LANGUAGE_PROFICIENCY = [
  { value: 'basic', label: 'Cơ bản' },
  { value: 'conversational', label: 'Giao tiếp' },
  { value: 'business', label: 'Thương mại' },
  { value: 'fluent', label: 'Thành thạo' },
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCY)[number]['value'];

/** 12. Khả năng đi công tác (2%). */
export enum TravelAbility {
  None = 'none',
  UpTo25 = 'up_to_25',
  From25To50 = '25_50',
  Over50 = 'over_50',
}

export const TRAVEL_ABILITY_LABEL: Record<TravelAbility, string> = {
  [TravelAbility.None]: 'Không',
  [TravelAbility.UpTo25]: '≤ 25% thời gian',
  [TravelAbility.From25To50]: '25 – 50% thời gian',
  [TravelAbility.Over50]: '> 50% thời gian',
};

/** 13. Bằng lái ô tô (1%). */
export const DRIVER_LICENSE_TYPES = ['B1', 'B2', 'C', 'D', 'E', 'Khác'] as const;

export type DriverLicenseType = (typeof DRIVER_LICENSE_TYPES)[number];

/** 14. Thu nhập kỳ vọng (2%) — base + tổng/tháng (OTE). */

// ---------------------------------------------------------------------------
// C. MỨC ĐỘ PHÙ HỢP (13%)
// ---------------------------------------------------------------------------

/** 15. Phong cách & hành vi bán hàng (5%) — tái dùng CustomerDevStyle / assessment. */

/** 16. Động lực nghề nghiệp (3%). */
export const CAREER_MOTIVATIONS = [
  'Thu nhập',
  'Thăng tiến',
  'Học hỏi',
  'Chủ động / tự chủ',
  'Môi trường',
  'Ổn định',
  'Khác',
] as const;

export type CareerMotivation = (typeof CAREER_MOTIVATIONS)[number];

/** 17. Phù hợp văn hóa (3%). */
export const WORK_STYLE_OPTIONS = [
  'Có cấu trúc / quy trình rõ',
  'Linh hoạt',
  'Tốc độ cao',
  'Tự chủ',
  'Làm việc nhóm',
  'Khác',
] as const;

export type WorkStyleOption = (typeof WORK_STYLE_OPTIONS)[number];

/** 18. Định hướng nghề nghiệp (2%). */
export const CAREER_ORIENTATIONS = [
  'Chuyên gia',
  'Quản lý',
  'Kinh doanh / BD',
  'Lãnh đạo đội ngũ',
  'Khác',
] as const;

export type CareerOrientation = (typeof CAREER_ORIENTATIONS)[number];

/** Vị trí mong muốn (hồ sơ — tối đa 3). */
export const DESIRED_POSITIONS = [
  'Sales Engineer',
  'Sales Executive',
  'Key Account Manager (KAM)',
  'Business Development (BD)',
  'Sales Manager',
  'Sales Supervisor',
  'Technical Sales',
  'Area Sales Manager',
  'Khác',
] as const;

export type DesiredPosition = (typeof DESIRED_POSITIONS)[number];

/** Trình độ học vấn. */
export const EDUCATION_LEVELS = [
  'THPT',
  'Trung cấp',
  'Cao đẳng',
  'Đại học',
  'Sau đại học',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

// ---------------------------------------------------------------------------
// Trọng số chấm điểm AI (18 tiêu chí = 100%)
// ---------------------------------------------------------------------------

export const B2B_MATCH_WEIGHTS = {
  /** A. Năng lực lõi — 75% */
  industry: 0.12,
  products: 0.11,
  customerSegments: 0.11,
  achievements: 0.1,
  customerDev: 0.08,
  b2bExperience: 0.07,
  sellingCapability: 0.07,
  dealProfile: 0.05,
  region: 0.04,
  /** B. Điều kiện công việc — 12% */
  readiness: 0.04,
  languages: 0.03,
  travel: 0.02,
  driversLicense: 0.01,
  expectedIncome: 0.02,
  /** C. Mức độ phù hợp — 13% */
  salesStyle: 0.05,
  careerMotivation: 0.03,
  cultureFit: 0.03,
  careerOrientation: 0.02,
} as const;

export type B2bMatchCriterionKey = keyof typeof B2B_MATCH_WEIGHTS;

export const B2B_MATCH_CRITERION_LABEL: Record<B2bMatchCriterionKey, string> = {
  industry: 'Ngành công nghiệp có kinh nghiệm',
  products: 'Sản phẩm/giải pháp từng bán',
  customerSegments: 'Tệp khách hàng từng bán',
  achievements: 'Thành tích kinh doanh',
  customerDev: 'Khả năng phát triển khách hàng mới',
  b2bExperience: 'Kinh nghiệm Sales B2B',
  sellingCapability: 'Năng lực bán hàng toàn chu trình',
  dealProfile: 'Loại hình & quy mô thương vụ',
  region: 'Khu vực/thị trường từng phụ trách',
  readiness: 'Sẵn sàng chuyển việc/thời gian nhận việc',
  languages: 'Ngoại ngữ',
  travel: 'Khả năng đi công tác',
  driversLicense: 'Bằng lái ô tô',
  expectedIncome: 'Thu nhập kỳ vọng',
  salesStyle: 'Phong cách & hành vi bán hàng',
  careerMotivation: 'Động lực nghề nghiệp',
  cultureFit: 'Phù hợp văn hóa doanh nghiệp',
  careerOrientation: 'Định hướng nghề nghiệp',
};

export const B2B_CRITERION_GROUP: Record<
  B2bMatchCriterionKey,
  'core' | 'conditions' | 'fit'
> = {
  industry: 'core',
  products: 'core',
  customerSegments: 'core',
  achievements: 'core',
  customerDev: 'core',
  b2bExperience: 'core',
  sellingCapability: 'core',
  dealProfile: 'core',
  region: 'core',
  readiness: 'conditions',
  languages: 'conditions',
  travel: 'conditions',
  driversLicense: 'conditions',
  expectedIncome: 'conditions',
  salesStyle: 'fit',
  careerMotivation: 'fit',
  cultureFit: 'fit',
  careerOrientation: 'fit',
};

export const B2B_CRITERION_GROUP_LABEL = {
  core: 'A. Năng lực lõi',
  conditions: 'B. Điều kiện công việc',
  fit: 'C. Mức độ phù hợp',
} as const;

/** Bộ lọc chính trên UI Search (A.1–A.9 rút gọn). */
export const B2B_MAIN_FILTER_KEYS = [
  'industry',
  'products',
  'customerSegments',
  'b2bExperience',
  'region',
] as const satisfies readonly B2bMatchCriterionKey[];

export const B2B_ADVANCED_FILTER_KEYS = [
  'achievements',
  'customerDev',
  'dealProfile',
  'sellingCapability',
  'readiness',
  'languages',
  'travel',
  'driversLicense',
  'expectedIncome',
] as const satisfies readonly B2bMatchCriterionKey[];

/** Trường còn thiếu khi AI đọc CV (gợi ý bổ sung). */
export type ProfileMissingFieldKey =
  | 'revenue'
  | 'kpi'
  | 'newCustomerRatio'
  | 'dealValue'
  | 'maxDeal'
  | 'sellingStages'
  | 'products'
  | 'customerSegments'
  | 'markets'
  | 'industries';

export const PROFILE_MISSING_FIELD_LABEL: Record<ProfileMissingFieldKey, string> = {
  revenue: 'Doanh số',
  kpi: '% hoàn thành KPI',
  newCustomerRatio: 'Tỷ lệ khách tự tìm',
  dealValue: 'Quy mô thương vụ điển hình',
  maxDeal: 'Thương vụ lớn nhất',
  sellingStages: 'Giai đoạn bán hàng đã làm',
  products: 'Sản phẩm/giải pháp đã bán',
  customerSegments: 'Tệp khách hàng',
  markets: 'Khu vực/thị trường',
  industries: 'Ngành công nghiệp',
};

// ---------------------------------------------------------------------------
// Helpers năm kinh nghiệm
// ---------------------------------------------------------------------------

export function experienceBandToYears(band: string | null | undefined): {
  min: number;
  max: number;
} | null {
  switch (band) {
    case 'none':
      return { min: 0, max: 99 };
    case 'under_1':
      return { min: 0, max: 1 };
    case '1_3':
      return { min: 1, max: 3 };
    case '3_5':
      return { min: 3, max: 5 };
    case '5_10':
      return { min: 5, max: 10 };
    case '5_plus':
      return { min: 5, max: 99 };
    case '10_plus':
      return { min: 10, max: 99 };
    default:
      return null;
  }
}

export function b2bBandToYears(band: B2bExperienceBand | string | null | undefined): {
  min: number;
  max: number;
} | null {
  if (!band) return null;
  return experienceBandToYears(band);
}

export function yearsToB2bBand(years: number | null | undefined): B2bExperienceBand | null {
  if (years == null || !Number.isFinite(years) || years < 0) return null;
  if (years < 1) return B2bExperienceBand.Under1;
  if (years < 3) return B2bExperienceBand.From1To3;
  if (years < 5) return B2bExperienceBand.From3To5;
  if (years < 10) return B2bExperienceBand.From5To10;
  return B2bExperienceBand.Over10;
}

export function kpiBandToPct(band: string | null | undefined): number | null {
  const hit = KPI_ACHIEVEMENT_BANDS.find((b) => b.value === band);
  return hit?.midPct ?? null;
}

export function newCustomerBandToPct(band: string | null | undefined): number | null {
  const hit = NEW_CUSTOMER_RATIO_BANDS.find((b) => b.value === band);
  return hit?.midPct ?? null;
}

export function dealValueBandToVnd(band: string | null | undefined): number | null {
  const hit = DEAL_VALUE_BANDS.find((b) => b.value === band);
  return hit?.midVnd ?? null;
}

/** Kiểm tra tổng trọng số = 1 (dùng trong test / assert). */
export function sumB2bMatchWeights(): number {
  return Object.values(B2B_MATCH_WEIGHTS).reduce((s, w) => s + w, 0);
}
