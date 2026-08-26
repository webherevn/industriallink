/**
 * Ma trận chuẩn hồ sơ ứng viên Sales B2B — IndustrialLink (update 18.8, 34 mục).
 *
 * A. Thông tin cơ bản (STT 1–12, chung cho Kỹ thuật & Kinh doanh) — 7%
 * B. Mong muốn nghề nghiệp (STT 13–16) — 13%
 * C. Định hướng & phù hợp (STT 17–19) — 5%
 * D. Kinh nghiệm công ty (STT 20–34, lặp cho từng công ty) — 75% (CỐT LÕI)
 *
 * AI đánh giá từng công ty theo mức độ liên quan với JD;
 * không lấy trung bình đơn giản giữa các công ty.
 */

import { INDUSTRY_GROUPS, type IndustryGroup } from './job-taxonomy';

// ---------------------------------------------------------------------------
// A. NĂNG LỰC LÕI (75%)
// ---------------------------------------------------------------------------

/** 1. Ngành công nghiệp có kinh nghiệm (12%). */
export const SALES_INDUSTRY_OPTIONS: readonly IndustryGroup[] = INDUSTRY_GROUPS.filter(
  (g) => g !== 'Khác',
);

/** STT 24. Sản phẩm / thiết bị đã bán — search + chọn nhiều + nhập thêm (16%). */
export const PRODUCTS_SOLD = [
  'Máy nén khí',
  'Máy phát điện',
  'Máy gia công CNC',
  'Máy cắt laser',
  'Máy chấn / máy dập',
  'Máy hàn',
  'Máy ép',
  'Dây chuyền sản xuất',
  'Robot công nghiệp',
  'PLC / HMI',
  'Biến tần / Servo',
  'Tủ điện',
  'Chiller',
  'AHU / FCU',
  'Hệ thống HVAC',
  'Cooling Tower',
  'Bơm công nghiệp',
  'Van công nghiệp',
  'Hệ thống đường ống',
  'Thiết bị nâng hạ / cầu trục',
  'Thiết bị PCCC',
  'Hệ thống xử lý nước',
  'Hệ thống lọc bụi / xử lý khí',
  'Thiết bị đo lường / cảm biến',
  'Hệ thống M&E / MEP',
  'Thiết bị công nghiệp khác',
] as const;

export type ProductSold = (typeof PRODUCTS_SOLD)[number];

export const PRODUCTS_SOLD_QUESTION = 'Anh/chị đã bán sản phẩm / thiết bị nào?';

/** STT 25. Nhóm khách hàng đã bán (11%) — ma trận 34 mục (update 18.8). */
export const CUSTOMER_SEGMENTS = [
  'Nhà thầu / đơn vị thi công',
  'Nhà máy FDI',
  'Nhà máy Việt Nam',
  'Tổng thầu EPC',
  'Chủ đầu tư',
  'Đại lý / nhà phân phối',
  'Đơn vị thương mại',
  'Khác',
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** Alias dữ liệu cũ → segment chuẩn 18.8. */
export const LEGACY_CUSTOMER_SEGMENT_MAP: Record<string, CustomerSegment> = {
  'Tổng thầu': 'Tổng thầu EPC',
  'Thầu phụ': 'Nhà thầu / đơn vị thi công',
  'Nhà thầu cơ điện / EPC': 'Tổng thầu EPC',
  'Nhà thầu M&E/EPC': 'Tổng thầu EPC',
  'Tập đoàn / Tổng thầu': 'Tổng thầu EPC',
  'Nhà sản xuất OEM': 'Khác',
  OEM: 'Khác',
  'Doanh nghiệp vừa và nhỏ': 'Khác',
  SME: 'Khác',
  'Quốc tế': 'Khác',
  'Đại lý & Kênh phân phối': 'Đại lý / nhà phân phối',
  'Đại lý / Nhà phân phối': 'Đại lý / nhà phân phối',
  'Đại lý/NPP': 'Đại lý / nhà phân phối',
};

export function normalizeCustomerSegment(raw: string): CustomerSegment | null {
  const trimmed = raw.trim();
  if ((CUSTOMER_SEGMENTS as readonly string[]).includes(trimmed)) {
    return trimmed as CustomerSegment;
  }
  return LEGACY_CUSTOMER_SEGMENT_MAP[trimmed] ?? null;
}
/** STT 30. Doanh số cá nhân 12 tháng gần nhất — nhập tự do (khuyến khích). */
export const PERSONAL_REVENUE_QUESTION =
  'Doanh số cá nhân của anh/chị trong 12 tháng gần nhất tại công ty này là bao nhiêu?';

export const PERSONAL_REVENUE_PLACEHOLDER = 'Ví dụ: 12 tỷ/năm';

/**
 * STT 31. Mức độ hoàn thành KPI (2%) — khuyến khích.
 * STT 32. Tỷ lệ khách hàng tự tìm kiếm (2%) — khuyến khích.
 */
export const KPI_ACHIEVEMENT_BANDS = [
  { value: 'under_70', label: 'Dưới 70%', midPct: 60 },
  { value: '70_100', label: '70 – 100%', midPct: 85 },
  { value: 'over_100', label: 'Trên 100%', midPct: 115 },
  { value: 'not_applicable', label: 'Không áp dụng KPI', midPct: null },
] as const;

export type KpiAchievementBand = (typeof KPI_ACHIEVEMENT_BANDS)[number]['value'];

/** Band KPI cũ → % giữa (tương thích dữ liệu đã lưu). */
const LEGACY_KPI_BAND_PCT: Record<string, number> = {
  '70_89': 80,
  '90_99': 95,
  '100_119': 110,
  '120_plus': 130,
};

export const NEW_CUSTOMER_RATIO_BANDS = [
  { value: 'under_50', label: 'Dưới 50%', midPct: 30 },
  { value: '50_80', label: '50 – 80%', midPct: 65 },
  { value: 'over_80', label: 'Trên 80%', midPct: 90 },
] as const;

export type NewCustomerRatioBand = (typeof NEW_CUSTOMER_RATIO_BANDS)[number]['value'];

/** Band tỷ lệ KH tự tìm cũ → % giữa (tương thích dữ liệu đã lưu). */
const LEGACY_NEW_CUSTOMER_BAND_PCT: Record<string, number> = {
  '0_20': 10,
  '21_40': 30,
  '41_60': 50,
  '61_80': 70,
  '80_plus': 90,
};

/** 5 / 15. Phong cách phát triển KH / Sales Persona. */
export enum CustomerDevStyle {
  Hunter = 'hunter',
  Hybrid = 'hybrid',
  Farmer = 'farmer',
}

export const CUSTOMER_DEV_STYLE_LABEL: Record<CustomerDevStyle, string> = {
  [CustomerDevStyle.Hunter]: 'Hunter — Tìm khách hàng mới',
  [CustomerDevStyle.Hybrid]: 'Hybrid — Cả khách mới và khách cũ',
  [CustomerDevStyle.Farmer]: 'Farmer — Chỉ khách hiện hữu',
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
 * STT 27. Phạm vi công việc bán hàng đã phụ trách (8%).
 * 12 hoạt động chuẩn theo ma trận 34 mục — có nút “Chọn tất cả”.
 */
export const SELLING_STAGES = [
  'Tìm kiếm khách hàng',
  'Tiếp cận & tạo cuộc hẹn',
  'Khảo sát & xác định nhu cầu',
  'Tư vấn sản phẩm / dịch vụ',
  'Xây dựng giải pháp / phương án',
  'Lập & gửi báo giá',
  'Thuyết trình / trình bày giải pháp',
  'Đàm phán & xử lý phản đối',
  'Chốt hợp đồng',
  'Theo dõi triển khai / giao hàng',
  'Thu hồi công nợ',
  'Chăm sóc khách hàng & bán thêm',
] as const;

export type SellingStage = (typeof SELLING_STAGES)[number];

export const SELLING_STAGES_QUESTION =
  'Anh/chị trực tiếp thực hiện những hoạt động nào? Chọn tất cả hoạt động phù hợp.';

/** Alias cũ → stage mới (CV parse / dữ liệu cũ). */
export const LEGACY_SELLING_STAGE_MAP: Record<string, SellingStage> = {
  'Tìm khách tiềm năng': 'Tìm kiếm khách hàng',
  'Tiếp cận': 'Tiếp cận & tạo cuộc hẹn',
  'Xác định nhu cầu': 'Khảo sát & xác định nhu cầu',
  'Khảo sát': 'Khảo sát & xác định nhu cầu',
  'Khảo sát hiện trường': 'Khảo sát & xác định nhu cầu',
  'Tư vấn sản phẩm': 'Tư vấn sản phẩm / dịch vụ',
  'Tư vấn kỹ thuật': 'Tư vấn sản phẩm / dịch vụ',
  'Xây dựng giải pháp': 'Xây dựng giải pháp / phương án',
  'Báo giá': 'Lập & gửi báo giá',
  'Thuyết trình': 'Thuyết trình / trình bày giải pháp',
  'Đàm phán': 'Đàm phán & xử lý phản đối',
  'Chốt đơn': 'Chốt hợp đồng',
  'Triển khai/giao hàng': 'Theo dõi triển khai / giao hàng',
  'Theo dõi triển khai': 'Theo dõi triển khai / giao hàng',
  'Bán thêm/bán chéo': 'Chăm sóc khách hàng & bán thêm',
  'Chăm sóc/bán thêm': 'Chăm sóc khách hàng & bán thêm',
  'Chăm sóc sau bán': 'Chăm sóc khách hàng & bán thêm',
};

export function normalizeSellingStage(raw: string): SellingStage | null {
  const trimmed = raw.trim();
  if ((SELLING_STAGES as readonly string[]).includes(trimmed)) {
    return trimmed as SellingStage;
  }
  return LEGACY_SELLING_STAGE_MAP[trimmed] ?? null;
}

/** STT 26. Giải pháp sản phẩm (5%) — chọn nhiều theo ma trận 34 mục. */
export enum DealType {
  Equipment = 'equipment',
  Consumables = 'consumables',
  Service = 'service',
  TechnicalSolution = 'technical_solution',
  Project = 'project',
  Other = 'other',
  /** @deprecated map → service (dữ liệu cũ) */
  Rental = 'rental',
  /** @deprecated map → equipment (dữ liệu cũ) */
  Standard = 'standard',
  /** @deprecated map → technical_solution (dữ liệu cũ) */
  Solution = 'solution',
}

/** Options UI / form — không gồm mã legacy. */
export const DEAL_TYPE_OPTIONS = [
  DealType.Equipment,
  DealType.Consumables,
  DealType.Service,
  DealType.TechnicalSolution,
  DealType.Project,
  DealType.Other,
] as const;

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  [DealType.Equipment]: 'Thiết bị',
  [DealType.Consumables]: 'Vật tư tiêu hao',
  [DealType.Service]: 'Dịch vụ kỹ thuật / cho thuê',
  [DealType.TechnicalSolution]: 'Giải pháp kỹ thuật',
  [DealType.Project]: 'Dự án',
  [DealType.Other]: 'Khác',
  [DealType.Rental]: 'Dịch vụ kỹ thuật / cho thuê',
  [DealType.Standard]: 'Thiết bị',
  [DealType.Solution]: 'Giải pháp kỹ thuật',
};

/** Tách chuỗi dealType (có thể lưu nhiều, phân tách bằng dấu phẩy) → mã chuẩn. */
export function splitDealTypes(raw: string | null | undefined): DealType[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,;|]/)
        .map((s) => normalizeDealTypeValue(s))
        .filter((v): v is DealType => v != null),
    ),
  ];
}

/** Ghép nhiều hình thức bán hàng → chuỗi lưu DB (giữ cột string hiện có). */
export function joinDealTypes(values: (DealType | string)[]): string | null {
  const cleaned = [...new Set(values.map((v) => `${v}`.trim()).filter(Boolean))];
  return cleaned.length ? cleaned.join(',') : null;
}

/** Hiển thị chuỗi dealType (1 hoặc nhiều) thành nhãn tiếng Việt. */
export function formatDealTypes(raw: string | null | undefined): string {
  const types = splitDealTypes(raw);
  if (!types.length) return raw?.trim() ?? '';
  return [...new Set(types.map((t) => DEAL_TYPE_LABEL[t]))].join(', ');
}

/** Chuẩn hoá dealType từ CV / dữ liệu cũ về mã 2.8. */
export function normalizeDealTypeValue(raw: string | null | undefined): DealType | null {
  if (!raw?.trim()) return null;
  const original = raw.trim();
  const s = original.toLowerCase();
  if ((Object.values(DealType) as string[]).includes(original)) {
    if (original === DealType.Standard) return DealType.Equipment;
    if (original === DealType.Solution) return DealType.TechnicalSolution;
    if (original === DealType.Rental) return DealType.Service;
    return original as DealType;
  }
  if (s.includes('cho thuê') || s.includes('thuê thiết bị') || s === 'rental') {
    return DealType.Service;
  }
  if (s.includes('vật tư') || s.includes('tiêu hao') || s === DealType.Consumables) {
    return DealType.Consumables;
  }
  if (s.includes('dịch vụ') || s === DealType.Service) return DealType.Service;
  if (s.includes('giải pháp') || s === 'solution') return DealType.TechnicalSolution;
  if (s.includes('dự án') || s.includes('project')) return DealType.Project;
  if (s === 'khác' || s === 'other') return DealType.Other;
  if (s.includes('thiết bị') || s.includes('tiêu chuẩn') || s.includes('sản phẩm') || s === 'standard') {
    return DealType.Equipment;
  }
  return null;
}

/** STT 33. Giá trị hợp đồng thường gặp (1%) — khuyến khích. */
export const DEAL_VALUE_BANDS = [
  { value: 'under_50m', label: 'Dưới 50 triệu', midVnd: 25_000_000 },
  { value: '50_200m', label: '50 – 200 triệu', midVnd: 125_000_000 },
  { value: '200_500m', label: '200 – 500 triệu', midVnd: 350_000_000 },
  { value: '0_5_2b', label: '500 triệu – 2 tỷ', midVnd: 1_250_000_000 },
  { value: '2_10b', label: '2 – 10 tỷ', midVnd: 6_000_000_000 },
  { value: '10b_plus', label: 'Trên 10 tỷ', midVnd: 15_000_000_000 },
] as const;

export type DealValueBand = (typeof DEAL_VALUE_BANDS)[number]['value'];

/** STT 29. Khu vực / thị trường phụ trách (2%) — ma trận 34 mục. */
export const MARKET_REGIONS = [
  'Miền Bắc',
  'Miền Trung',
  'Miền Nam',
  'Toàn quốc',
  'Quốc tế',
  'Khác',
] as const;

export type MarketRegion = (typeof MARKET_REGIONS)[number];

/**
 * STT 14. Địa điểm mong muốn làm việc — chọn nhiều Tỉnh/Thành phố/Khu vực.
 * (Danh sách khu vực + tỉnh/TP công nghiệp trọng điểm.)
 */
export const DESIRED_LOCATION_OPTIONS = [
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
  'Toàn quốc',
] as const;

export type DesiredLocationOption = (typeof DESIRED_LOCATION_OPTIONS)[number];

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
  [AvailabilityBand.Under15]: 'Trong 15 ngày',
  [AvailabilityBand.Under30]: 'Trong 30 ngày',
  [AvailabilityBand.Days30To60]: '30 – 60 ngày',
  [AvailabilityBand.Over60]: 'Trên 60 ngày',
};

export const AVAILABILITY_QUESTION = 'Khi nào có thể bắt đầu công việc mới?';

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

/** STT 10. Ngoại ngữ (2%) — chọn ngôn ngữ dùng trong công việc. */
export const LANGUAGE_OPTIONS = [
  'Tiếng Anh',
  'Tiếng Trung',
  'Tiếng Nhật',
  'Tiếng Hàn',
  'Khác',
] as const;

export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export const LANGUAGE_QUESTION =
  'Anh/chị sử dụng ngoại ngữ nào trong công việc?';

/** Mức độ sử dụng ngoại ngữ trong công việc (STT 10). */
export const LANGUAGE_SKILL_LEVELS = [
  { value: 'basic', label: 'Cơ bản' },
  { value: 'intermediate', label: 'Khá' },
  { value: 'good', label: 'Tốt' },
  { value: 'fluent', label: 'Thành thạo' },
] as const;

export type LanguageSkillLevel = (typeof LANGUAGE_SKILL_LEVELS)[number]['value'];

export const LANGUAGE_WORK_USAGE_LABEL = 'Mức độ sử dụng trong công việc';

/** @deprecated dùng LANGUAGE_SKILL_LEVELS — giữ alias tương thích. */
export const LANGUAGE_PROFICIENCY = [
  { value: 'basic', label: 'Cơ bản' },
  { value: 'conversational', label: 'Giao tiếp' },
  { value: 'business', label: 'Thương mại' },
  { value: 'fluent', label: 'Thành thạo' },
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCY)[number]['value'];

/** Chi tiết ngoại ngữ theo ma trận 34 mục: 1 mức độ sử dụng trong công việc. */
export interface LanguageSkill {
  language: string;
  /** Mức độ sử dụng trong công việc (Cơ bản / Khá / Tốt / Thành thạo). */
  workUsage?: LanguageSkillLevel | null;
  /** @deprecated dữ liệu cũ nghe/nói/đọc/viết — giữ để tương thích. */
  listening: LanguageSkillLevel | null;
  speaking: LanguageSkillLevel | null;
  reading: LanguageSkillLevel | null;
  writing: LanguageSkillLevel | null;
  /** @deprecated Đọc manual / tài liệu kỹ thuật bằng ngôn ngữ này. */
  technicalManualReading: LanguageSkillLevel | null;
}

/** Lấy mức sử dụng trong công việc — fallback mức cao nhất của dữ liệu cũ. */
export function languageWorkUsage(skill: LanguageSkill): LanguageSkillLevel | null {
  if (skill.workUsage) return skill.workUsage;
  const order: LanguageSkillLevel[] = ['basic', 'intermediate', 'good', 'fluent'];
  const legacy = [
    skill.listening,
    skill.speaking,
    skill.reading,
    skill.writing,
    skill.technicalManualReading,
  ].filter((v): v is LanguageSkillLevel => Boolean(v));
  if (!legacy.length) return null;
  return legacy.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
}

export const LANGUAGE_SKILL_DIMENSIONS = [
  { key: 'listening', label: 'Nghe' },
  { key: 'speaking', label: 'Nói' },
  { key: 'reading', label: 'Đọc' },
  { key: 'writing', label: 'Viết' },
  { key: 'technicalManualReading', label: 'Đọc manual kỹ thuật' },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<LanguageSkill, 'language'>;
  label: string;
}>;

export function emptyLanguageSkill(language: string): LanguageSkill {
  return {
    language,
    workUsage: null,
    listening: null,
    speaking: null,
    reading: null,
    writing: null,
    technicalManualReading: null,
  };
}

/** Đồng bộ danh sách tên ngôn ngữ từ chi tiết kỹ năng. */
export function languageNamesFromSkills(skills: LanguageSkill[] | null | undefined): string[] {
  return [...new Set((skills ?? []).map((s) => s.language.trim()).filter(Boolean))];
}

/** Ghép languages[] cũ → languageSkills (giữ skill đã có). */
export function mergeLanguageSkills(
  languages: string[] | null | undefined,
  skills: LanguageSkill[] | null | undefined,
): LanguageSkill[] {
  const byName = new Map<string, LanguageSkill>();
  for (const s of skills ?? []) {
    const name = s.language?.trim();
    if (!name) continue;
    byName.set(name, {
      language: name,
      workUsage: s.workUsage ?? null,
      listening: s.listening ?? null,
      speaking: s.speaking ?? null,
      reading: s.reading ?? null,
      writing: s.writing ?? null,
      technicalManualReading: s.technicalManualReading ?? null,
    });
  }
  const names =
    (languages?.length ?? 0) > 0 ? languages! : languageNamesFromSkills(skills);
  for (const name of names) {
    const t = name.trim();
    if (!t || byName.has(t)) continue;
    byName.set(t, emptyLanguageSkill(t));
  }
  // Giữ thứ tự theo languages nếu có, rồi skill còn lại
  const ordered: LanguageSkill[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const t = name.trim();
    if (!t || seen.has(t)) continue;
    const row = byName.get(t);
    if (row) {
      ordered.push(row);
      seen.add(t);
    }
  }
  for (const [name, row] of byName) {
    if (!seen.has(name)) ordered.push(row);
  }
  return ordered;
}

export function formatLanguageSkillSummary(skill: LanguageSkill): string {
  const usage = languageWorkUsage(skill);
  if (!usage) return skill.language;
  const label = LANGUAGE_SKILL_LEVELS.find((l) => l.value === usage)?.label ?? usage;
  return `${skill.language} (${label})`;
}

/** STT 12. Khả năng đi công tác (1%) — bắt buộc. */
export enum TravelAbility {
  None = 'none',
  UpTo25 = 'up_to_25',
  From25To50 = '25_50',
  Over50 = 'over_50',
}

export const TRAVEL_ABILITY_LABEL: Record<TravelAbility, string> = {
  [TravelAbility.None]: 'Không thể đi công tác',
  [TravelAbility.UpTo25]: 'Có thể đi công tác khi cần',
  [TravelAbility.From25To50]: 'Có thể đi công tác thường xuyên',
  [TravelAbility.Over50]: 'Sẵn sàng đi công tác dài ngày',
};

export const TRAVEL_ABILITY_QUESTION = 'Anh/chị có thể đi công tác như thế nào?';

/** STT 11. Giấy phép lái xe (0,5%) — chọn nhiều. */
export const DRIVER_LICENSE_TYPES = ['Chưa có', 'Xe máy', 'Ô tô', 'Khác'] as const;

export type DriverLicenseType = (typeof DRIVER_LICENSE_TYPES)[number];

export const DRIVER_LICENSE_QUESTION = 'Anh/chị có bằng lái gì?';

/** Chuẩn hoá giá trị bằng lái đã lưu (B1/B2/C… cũ → Ô tô). */
export function parseDriverLicenses(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const legacyCar = new Set(['B1', 'B2', 'C', 'D', 'E', 'FC']);
  const out = raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (legacyCar.has(s.toUpperCase()) ? 'Ô tô' : s));
  return [...new Set(out)];
}

/** Ghép danh sách bằng lái → chuỗi lưu DB. */
export function joinDriverLicenses(values: string[]): string | null {
  const cleaned = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return cleaned.length ? cleaned.join(', ') : null;
}

/** STT 15. Thu nhập tối thiểu có thể chấp nhận & thu nhập kỳ vọng (3%). */
export const EXPECTED_INCOME_QUESTION = 'Mức thu nhập mong muốn?';

// ---------------------------------------------------------------------------
// C. MỨC ĐỘ PHÙ HỢP (13%)
// ---------------------------------------------------------------------------

/** 15. Phong cách & hành vi bán hàng (5%). */
export const SALES_BEHAVIOR_OPTIONS = [
  'Chờ Marketing cung cấp thêm lead',
  'Tập trung khách cũ có khả năng mua thêm',
  'Chủ động xây danh sách khách mới và tiếp cận',
  'Tập trung vài deal lớn đang gần chốt',
] as const;

export type SalesBehaviorOption = (typeof SALES_BEHAVIOR_OPTIONS)[number];

export const SALES_BEHAVIOR_QUESTION =
  'Bạn thường ưu tiên làm gì?';

/** Map câu trả lời assessment → persona Hunter/Hybrid/Farmer (matching). */
export function salesBehaviorToDevStyle(
  behavior: string | null | undefined,
): CustomerDevStyle | null {
  if (!behavior) return null;
  if (behavior.includes('khách mới') || behavior.includes('Chủ động')) {
    return CustomerDevStyle.Hunter;
  }
  if (behavior.includes('deal lớn') || behavior.includes('gần chốt')) {
    return CustomerDevStyle.Hybrid;
  }
  if (
    behavior.includes('khách cũ') ||
    behavior.includes('Marketing') ||
    behavior.includes('lead')
  ) {
    return CustomerDevStyle.Farmer;
  }
  return null;
}

/** STT 19. Động lực khi lựa chọn công việc mới (1%) — chọn đúng 3. */
export const CAREER_MOTIVATIONS = [
  'Thu nhập & hoa hồng',
  'Sản phẩm/dịch vụ dễ bán',
  'Có khách hàng & thị trường tốt',
  'Chính sách công ty & quản lý tốt',
  'Cơ hội phát triển/thăng tiến',
  'Công việc ổn định',
] as const;

export type CareerMotivation = (typeof CAREER_MOTIVATIONS)[number];

export const CAREER_MOTIVATION_QUESTION =
  'Hãy chọn 3 yếu tố quan trọng nhất khi anh/chị lựa chọn công việc mới.';

/** STT 18. Phong cách làm việc & môi trường phù hợp (2%) — 2 cặp A/B. */
export const CULTURE_FIT_QUESTIONS = [
  {
    id: 'workstyle',
    question: 'Bạn thích cách làm việc nào hơn?',
    options: ['Có hướng dẫn cụ thể', 'Giao mục tiêu, tự chủ cách làm'],
  },
  {
    id: 'environment',
    question: 'Bạn thích môi trường làm việc nào hơn?',
    options: ['Ổn định', 'Năng động, thay đổi nhanh'],
  },
] as const;

export type CultureFitQuestionId = (typeof CULTURE_FIT_QUESTIONS)[number]['id'];

export type CultureFitAnswers = Partial<Record<CultureFitQuestionId, string>>;

export const CULTURE_FIT_SECTION_TITLE = 'Phong cách làm việc & môi trường phù hợp';
export const CULTURE_FIT_SUBTITLE = 'Phong cách & môi trường làm việc phù hợp với bạn?';

/** Tag phẳng dùng cho matching (lấy từ các lựa chọn assessment). */
export const WORK_STYLE_OPTIONS = [
  'Có hướng dẫn cụ thể',
  'Giao mục tiêu, tự chủ cách làm',
  'Ổn định',
  'Năng động, thay đổi nhanh',
] as const;

export type WorkStyleOption = (typeof WORK_STYLE_OPTIONS)[number];

/** Alias câu trả lời cũ (bản 4 câu) → bản 18.8 (2 câu). */
const LEGACY_WORK_STYLE_MAP: Record<string, WorkStyleOption> = {
  'Có quy trình và hướng dẫn rõ ràng': 'Có hướng dẫn cụ thể',
  'Được tự chủ cách đạt mục tiêu': 'Giao mục tiêu, tự chủ cách làm',
  'Ổn định, ít thay đổi': 'Ổn định',
  'Nhanh, nhiều thay đổi và cơ hội mới': 'Năng động, thay đổi nhanh',
  'Quản lý theo sát và hỗ trợ thường xuyên': 'Có hướng dẫn cụ thể',
  'Giao mục tiêu và trao quyền': 'Giao mục tiêu, tự chủ cách làm',
};

export function cultureFitAnswersToWorkStyles(answers: CultureFitAnswers): string[] {
  return CULTURE_FIT_QUESTIONS.map((q) => answers[q.id])
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim());
}

export function workStylesToCultureFitAnswers(
  styles: string[] | null | undefined,
): CultureFitAnswers {
  const list = (styles ?? []).map((s) => LEGACY_WORK_STYLE_MAP[s.trim()] ?? s.trim());
  const answers: CultureFitAnswers = {};
  for (const q of CULTURE_FIT_QUESTIONS) {
    const found = list.find((s) => (q.options as readonly string[]).includes(s));
    if (found) answers[q.id] = found;
  }
  return answers;
}

/** STT 17. Định hướng nghề nghiệp (2%) — chọn 1. */
export const CAREER_ORIENTATIONS = [
  'Giỏi chuyên môn Sales',
  'Bán khách hàng lớn',
  'Quản lý kinh doanh/đội nhóm',
  'Quản lý sản phẩm/ngành hàng',
  'Chưa xác định',
] as const;

export type CareerOrientation = (typeof CAREER_ORIENTATIONS)[number];

export const CAREER_ORIENTATION_QUESTION =
  'Trong 3 năm tới anh/chị muốn phát triển theo hướng nào?';

/** Chuẩn hoá lựa chọn UI (Khác: … → Khác) để tick checkbox. */
export function careerOrientationSelection(orientations: string[]): string[] {
  return orientations.map((o) => (o === 'Khác' || o.startsWith('Khác:') ? 'Khác' : o));
}

/** Lấy phần ghi chú sau “Khác:”. */
export function parseCareerOrientationOther(orientations: string[]): string {
  const other = orientations.find((o) => o.startsWith('Khác:'));
  if (!other) return '';
  return other.replace(/^Khác:\s*/, '').trim();
}

/** Ghi lại danh sách định hướng kèm ô “Khác: ______”. */
export function withCareerOrientationOther(
  orientations: string[],
  otherText: string,
): string[] {
  const base = orientations.filter((o) => o !== 'Khác' && !o.startsWith('Khác:'));
  const wantsOther = orientations.some((o) => o === 'Khác' || o.startsWith('Khác:'));
  if (!wantsOther) return base;
  const trimmed = otherText.trim();
  return [...base, trimmed ? `Khác: ${trimmed}` : 'Khác'];
}

/** Alias định hướng cũ → bản 18.8 (5 lựa chọn). */
export const LEGACY_CAREER_ORIENTATION_MAP: Record<string, CareerOrientation> = {
  'Chuyên gia kinh doanh B2B': 'Giỏi chuyên môn Sales',
  'Sales B2B chuyên nghiệp': 'Giỏi chuyên môn Sales',
  'Sales Engineer/Chuyên gia giải pháp': 'Giỏi chuyên môn Sales',
  'Chuyên viên quản lý khách hàng chiến lược': 'Bán khách hàng lớn',
  'Key Account': 'Bán khách hàng lớn',
  'Chuyên viên phát triển kinh doanh': 'Giỏi chuyên môn Sales',
  'Business Development': 'Giỏi chuyên môn Sales',
  'Trưởng nhóm kinh doanh': 'Quản lý kinh doanh/đội nhóm',
  'Trưởng nhóm Sales': 'Quản lý kinh doanh/đội nhóm',
  'Trưởng phòng kinh doanh': 'Quản lý kinh doanh/đội nhóm',
  'Sales Manager': 'Quản lý kinh doanh/đội nhóm',
  'Giám đốc kinh doanh': 'Quản lý kinh doanh/đội nhóm',
};

/** STT 13. Vị trí ứng tuyển (5%) — bắt buộc, chọn nhiều. */
export const DESIRED_POSITIONS = [
  'Nhân viên kinh doanh',
  'Trưởng nhóm kinh doanh',
  'Trưởng phòng kinh doanh',
  'Quản lý sản phẩm / ngành hàng',
  'Giám đốc kinh doanh',
] as const;

export type DesiredPosition = (typeof DESIRED_POSITIONS)[number];

export const DESIRED_POSITION_QUESTION = 'Anh/chị đang tìm công việc nào?';

/** Alias vị trí cũ (EN / bản 2.8) → bản 18.8. */
export const LEGACY_DESIRED_POSITION_MAP: Record<string, DesiredPosition> = {
  'Sales Engineer': 'Nhân viên kinh doanh',
  'Sales Executive': 'Nhân viên kinh doanh',
  'Technical Sales': 'Nhân viên kinh doanh',
  'Quản lý khách hàng': 'Nhân viên kinh doanh',
  'Key Account Manager (KAM)': 'Nhân viên kinh doanh',
  'Business Development (BD)': 'Nhân viên kinh doanh',
  'Sales Supervisor': 'Trưởng nhóm kinh doanh',
  'Sales Manager': 'Trưởng phòng kinh doanh',
  'Area Sales Manager': 'Trưởng phòng kinh doanh',
  'Product Manager': 'Quản lý sản phẩm / ngành hàng',
};

/**
 * STT 34. Thành tích kinh doanh nổi bật tại công ty (2%) — khuyến khích.
 */
export const SALES_HIGHLIGHTS_QUESTION =
  'Thành tích kinh doanh nổi bật tại công ty này?';

export const SALES_HIGHLIGHTS_HINT =
  'VD: Đạt 130% KPI năm 2025 · Mang về 15 khách hàng mới · Chốt hợp đồng 8 tỷ';

export const SALES_HIGHLIGHTS_PLACEHOLDER =
  'VD: Đạt 130% KPI năm 2025\nMang về 15 khách hàng mới\nChốt hợp đồng 8 tỷ';

/** Trình độ học vấn. */
export const EDUCATION_LEVELS = [
  'THPT',
  'Trung cấp',
  'Cao đẳng',
  'Đại học',
  'Sau đại học',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** Xếp loại tốt nghiệp / bằng cấp. */
export const EDUCATION_CLASSIFICATIONS = [
  'Trung bình',
  'Khá',
  'Giỏi',
  'Xuất sắc',
] as const;

export type EducationClassification = (typeof EDUCATION_CLASSIFICATIONS)[number];

/** Ghép xếp loại + chuyên ngành → degree hiển thị trên CV. */
export function composeEducationDegree(
  classification: string | null | undefined,
  major: string | null | undefined,
): string {
  const c = (classification ?? '').trim();
  const m = (major ?? '').trim();
  if (c && m) return `${c} — ${m}`;
  return c || m;
}

/** Tách degree CV thành xếp loại + chuyên ngành (tương thích dữ liệu cũ). */
export function parseEducationDegree(degree: string | null | undefined): {
  classification: string;
  major: string;
} {
  const raw = (degree ?? '').trim();
  if (!raw) return { classification: '', major: '' };
  for (const c of EDUCATION_CLASSIFICATIONS) {
    if (raw === c) return { classification: c, major: '' };
    const prefix = `${c} — `;
    if (raw.startsWith(prefix)) {
      return { classification: c, major: raw.slice(prefix.length).trim() };
    }
  }
  return { classification: '', major: raw };
}

// ---------------------------------------------------------------------------
// Trọng số matching JD — gom ma trận 34 mục (điểm gợi ý chi tiết ở
// ai-suggestion-weights.ts) về 18 key engine. A 2% + B 11% + C 5% + D 5% + E 75%.
// ---------------------------------------------------------------------------

export const B2B_MATCH_WEIGHTS = {
  /** E. Kinh nghiệm công ty */
  industry: 0.12, // STT 23 Ngành / lĩnh vực
  products: 0.18, // STT 24 Sản phẩm/thiết bị (16%) + STT 28 Hãng (1%) + làm tròn
  customerSegments: 0.11, // STT 25 Nhóm khách hàng đã bán
  achievements: 0.07, // STT 30 Doanh số (3%) + STT 31 KPI (2%) + STT 34 Thành tích (2%)
  customerDev: 0.02, // STT 32 Tỷ lệ khách hàng tự tìm kiếm
  b2bExperience: 0.1, // STT 21 Vị trí (5%) + STT 22 Thời gian làm việc (5%)
  sellingCapability: 0.08, // STT 27 Phạm vi công việc bán hàng
  dealProfile: 0.06, // STT 26 Hình thức bán hàng (5%) + STT 33 Giá trị HĐ (1%)
  region: 0.06, // STT 29 Khu vực (2%) + STT 7 Địa điểm mong muốn (2%) + STT 5 Nơi sống (2%)
  /** B. Mong muốn */
  readiness: 0.01, // STT 9 Thời gian có thể nhận việc
  expectedIncome: 0.03, // STT 8 Thu nhập tối thiểu & kỳ vọng
  /** C. Học vấn & điều kiện */
  languages: 0.02, // STT 14 Ngoại ngữ
  travel: 0.01, // STT 16 Khả năng đi công tác
  driversLicense: 0.01, // STT 15 GPLX 0,5% + STT 10/12/13 học vấn 0,5%×3 làm tròn
  /** D. Định hướng + vị trí ứng tuyển */
  salesStyle: 0.02, // STT 19 Phong cách làm việc & môi trường
  careerMotivation: 0.01, // STT 17 Động lực khi lựa chọn công việc mới
  cultureFit: 0.02, // STT 19 (giữ key matching) — cùng nhóm fit
  careerOrientation: 0.07, // STT 18 Định hướng (2%) + STT 6 Vị trí ứng tuyển (5%)
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
  core: 'D. Kinh nghiệm & năng lực lõi',
  conditions: 'A/B. Thông tin & mong muốn',
  fit: 'C. Định hướng & phù hợp',
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
  if (!band) return null;
  const hit = KPI_ACHIEVEMENT_BANDS.find((b) => b.value === band);
  if (hit) return hit.midPct;
  return LEGACY_KPI_BAND_PCT[band] ?? null;
}

export function newCustomerBandToPct(band: string | null | undefined): number | null {
  if (!band) return null;
  const hit = NEW_CUSTOMER_RATIO_BANDS.find((b) => b.value === band);
  if (hit) return hit.midPct;
  return LEGACY_NEW_CUSTOMER_BAND_PCT[band] ?? null;
}

export function dealValueBandToVnd(band: string | null | undefined): number | null {
  const hit = DEAL_VALUE_BANDS.find((b) => b.value === band);
  return hit?.midVnd ?? null;
}

/** Kiểm tra tổng trọng số = 1 (dùng trong test / assert). */
export function sumB2bMatchWeights(): number {
  return Object.values(B2B_MATCH_WEIGHTS).reduce((s, w) => s + w, 0);
}
