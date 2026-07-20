/**
 * Tiêu chí chấm điểm / lọc ứng viên Sales B2B công nghiệp Việt Nam.
 * Dùng chung cho bộ lọc Web, matching AI và hồ sơ ứng viên.
 */

import { INDUSTRY_GROUPS, type IndustryGroup } from './job-taxonomy';

/** 1. Ngành công nghiệp có kinh nghiệm (tái dùng INDUSTRY_GROUPS, bỏ Khác khỏi gợi ý chính). */
export const SALES_INDUSTRY_OPTIONS: readonly IndustryGroup[] = INDUSTRY_GROUPS.filter(
  (g) => g !== 'Khác',
);

/** 2. Sản phẩm / giải pháp đã từng bán. */
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

/** 3. Tệp khách hàng đã từng bán. */
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
 * 4. Số năm kinh nghiệm Sales B2B.
 * (Tách khỏi ExperienceBand của tin tuyển dụng để có đủ 5–10 và >10.)
 */
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

/** 5. Khu vực / thị trường đã phụ trách. */
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

/** 7. Khả năng phát triển khách hàng mới. */
export enum CustomerDevStyle {
  Hunter = 'hunter',
  Hybrid = 'hybrid',
  Farmer = 'farmer',
}

export const CUSTOMER_DEV_STYLE_LABEL: Record<CustomerDevStyle, string> = {
  [CustomerDevStyle.Hunter]: 'Chuyên tìm khách mới',
  [CustomerDevStyle.Hybrid]: 'Cả khách mới và khách cũ',
  [CustomerDevStyle.Farmer]: 'Chăm sóc khách hiện hữu',
};

/** 8. Loại hình thương vụ. */
export enum DealType {
  Standard = 'standard',
  Solution = 'solution',
  Project = 'project',
}

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  [DealType.Standard]: 'Bán hàng tiêu chuẩn',
  [DealType.Solution]: 'Bán giải pháp',
  [DealType.Project]: 'Bán dự án',
};

/**
 * 9. Năng lực bán hàng kỹ thuật / giải pháp — các bước đã tham gia.
 */
export const SELLING_STAGES = [
  'Tìm khách tiềm năng',
  'Khảo sát hiện trường',
  'Tư vấn kỹ thuật',
  'Xây dựng giải pháp',
  'Báo giá',
  'Đàm phán',
  'Chốt đơn',
  'Thu hồi công nợ',
] as const;

export type SellingStage = (typeof SELLING_STAGES)[number];

/** 10. Mức độ sẵn sàng chuyển việc. */
export enum JobReadiness {
  Active = 'active',
  Open = 'open',
  Passive = 'passive',
}

export const JOB_READINESS_LABEL: Record<JobReadiness, string> = {
  [JobReadiness.Active]: 'Chủ động tìm việc',
  [JobReadiness.Open]: 'Sẵn sàng nghe cơ hội',
  [JobReadiness.Passive]: 'Chưa có nhu cầu',
};

/** Điều kiện bổ sung — ngoại ngữ. */
export const LANGUAGE_OPTIONS = [
  'Tiếng Anh giao tiếp',
  'Tiếng Anh thương mại',
  'Tiếng Trung',
  'Tiếng Nhật',
  'Tiếng Hàn',
  'Khác',
] as const;

export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

/**
 * Trọng số chấm điểm matching Sales B2B (tổng ≈ 1.0).
 * 5 bộ lọc chính chiếm phần lớn; nâng cao là boost; semantic/skills giữ tín hiệu AI.
 */
export const B2B_MATCH_WEIGHTS = {
  industry: 0.18,
  products: 0.16,
  customerSegments: 0.12,
  b2bExperience: 0.12,
  region: 0.1,
  achievements: 0.05,
  customerDev: 0.04,
  dealProfile: 0.04,
  sellingCapability: 0.04,
  readiness: 0.05,
  semanticSkills: 0.1,
} as const;

export type B2bMatchCriterionKey = keyof typeof B2B_MATCH_WEIGHTS;

export const B2B_MATCH_CRITERION_LABEL: Record<B2bMatchCriterionKey, string> = {
  industry: 'Ngành công nghiệp',
  products: 'Sản phẩm / giải pháp đã bán',
  customerSegments: 'Tệp khách hàng',
  b2bExperience: 'Kinh nghiệm kinh doanh B2B',
  region: 'Khu vực / thị trường',
  achievements: 'Thành tích kinh doanh',
  customerDev: 'Phát triển khách hàng mới',
  dealProfile: 'Loại hình & quy mô thương vụ',
  sellingCapability: 'Năng lực bán giải pháp',
  readiness: 'Mức độ sẵn sàng',
  semanticSkills: 'Ngữ nghĩa & kỹ năng',
};

/** Nhóm UI: bộ lọc chính vs nâng cao. */
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
] as const satisfies readonly B2bMatchCriterionKey[];

/** Map ExperienceBand tin tuyển dụng → khoảng năm tối thiểu/tối đa để so với hồ sơ B2B. */
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
