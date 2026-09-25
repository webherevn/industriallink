/**
 * Engine Matching JD ↔ hồ sơ — Sales B2B.
 * Nguồn: Bảng quy tắc lập trình v1.0 (10.09.2026) — 47 quy tắc A–I.
 * Bảng tra cứu: du_lieu_matching_sales.json (1.0 / 2026-09-15).
 * jd04 / jd15: Quy tắc địa điểm & chuyên ngành v1.2 (17.09.2026).
 * Không gọi LLM lúc chấm (I5). Cùng đầu vào luôn ra cùng đầu ra.
 */

import {
  CUSTOMER_SEGMENTS,
  DESIRED_POSITIONS,
  DealType,
  EDUCATION_LEVELS,
  LANGUAGE_SKILL_LEVELS,
  LEGACY_DESIRED_POSITION_MAP,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  TravelAbility,
  experienceBandToYears,
  languageWorkUsage,
  normalizeCustomerSegment,
  normalizeDealTypeValue,
  normalizeSellingStage,
  type CustomerSegment,
  type LanguageSkill,
  type LanguageSkillLevel,
  type MarketRegion,
  type ProductSold,
  type SellingStage,
} from './sales-b2b-criteria';
import { resolveVnProvince2025, vnMacroRegionOf } from './vn-admin-units';
import {
  CUSTOMER_SEGMENT_SIMILARITY_MATRIX,
  DEAL_TYPE_SIMILARITY_MATRIX,
  INDUSTRY_CLUSTER_SIMILARITY_MATRIX,
  MAJOR_KEYWORDS_KINH_TE,
  MAJOR_KEYWORDS_KY_THUAT,
  PRODUCT_MATCH_CODES,
  PRODUCT_MATCH_NAMES,
  PRODUCT_SIMILARITY_MATRIX,
  REGION_SIMILARITY_MATRIX,
  SALES_MATCH_CONSTANTS,
} from './sales-matching-tables';
import {
  findIndustryGroupBySub,
  normalizeIndustry,
  type IndustryGroup,
} from './job-taxonomy';
import type { JdSalesFieldKey, JobSalesCriteria } from './jd-sales-matching';
import type {
  MatchCriterionScore,
  MatchExplanation,
  SalesMatchCompanySummary,
  SalesMatchFieldCode,
  SalesMatchFieldDetail,
  SalesMatchResult,
} from './matching.dto';

export {
  SALES_MATCH_CONSTANTS,
  SALES_MATCH_DATA_VERSION,
  PRODUCT_MATCH_CODES,
  PRODUCT_MATCH_NAMES,
  PRODUCT_MATCH_CLUSTER,
  PRODUCT_SIMILARITY_MATRIX,
  PROVINCE_TO_MACRO_REGION,
  MAJOR_KEYWORDS_KY_THUAT,
  MAJOR_KEYWORDS_KINH_TE,
} from './sales-matching-tables';

// ---------------------------------------------------------------------------
// A · Khối và trọng số
// ---------------------------------------------------------------------------

/** A3 + A4. Tổng A5 = 100 = 83 công ty + 17 chung. */
export const SALES_MATCH_FIELD_WEIGHTS: Record<SalesMatchFieldCode, number> = {
  jd01a: 1,
  jd01b: 3,
  jd02: 15,
  jd04: 2,
  jd05: 5,
  jd06: 2,
  jd09: 20,
  jd10: 18,
  jd11: 7,
  jd12: 13,
  jd13: 7,
  jd14: 1,
  jd15: 1,
  jd16: 2,
  jd17: 1,
  jd18: 2,
};

export const SALES_MATCH_COMPANY_FIELDS: readonly SalesMatchFieldCode[] = [
  'jd01b',
  'jd02',
  'jd09',
  'jd10',
  'jd11',
  'jd12',
  'jd13',
];

export const SALES_MATCH_PROFILE_FIELDS: readonly SalesMatchFieldCode[] = [
  'jd01a',
  'jd04',
  'jd05',
  'jd06',
  'jd14',
  'jd15',
  'jd16',
  'jd17',
  'jd18',
];

export const SALES_MATCH_FIELD_LABEL: Record<SalesMatchFieldCode, string> = {
  jd01a: 'Vị trí ứng tuyển',
  jd01b: 'Vị trí đã làm',
  jd02: 'Ngành / lĩnh vực',
  jd04: 'Địa điểm làm việc',
  jd05: 'Kinh nghiệm yêu cầu',
  jd06: 'Mức thu nhập',
  jd09: 'Sản phẩm / thiết bị',
  jd10: 'Nhóm khách hàng',
  jd11: 'Giải pháp sản phẩm',
  jd12: 'Phạm vi công việc bán hàng',
  jd13: 'Khu vực / thị trường',
  jd14: 'Trình độ học vấn',
  jd15: 'Chuyên ngành',
  jd16: 'Ngoại ngữ',
  jd17: 'Giấy phép lái xe',
  jd18: 'Khả năng đi công tác',
};

/** D2 — α chiết khấu ngành. D3: không áp cho jd02. D4: khối chung = 0. */
export const SALES_MATCH_FIELD_ALPHA: Record<SalesMatchFieldCode, number> = {
  jd01a: 0,
  jd01b: 0.3,
  jd02: 0,
  jd04: 0,
  jd05: 0,
  jd06: 0,
  jd09: 0.7,
  jd10: 0.6,
  jd11: 0.5,
  jd12: 0,
  jd13: 0.2,
  jd14: 0,
  jd15: 0,
  jd16: 0,
  jd17: 0,
  jd18: 0,
};

const COMPANY_WEIGHT_SUM = SALES_MATCH_CONSTANTS.KHOI_CONG_TY;
const PROFILE_WEIGHT_SUM = SALES_MATCH_CONSTANTS.KHOI_CHUNG;

/** A5 — gọi lúc import / khởi động. Sai thì không cho chạy. */
export function assertSalesMatchWeights(): void {
  const company = SALES_MATCH_COMPANY_FIELDS.reduce(
    (s, k) => s + SALES_MATCH_FIELD_WEIGHTS[k],
    0,
  );
  const profile = SALES_MATCH_PROFILE_FIELDS.reduce(
    (s, k) => s + SALES_MATCH_FIELD_WEIGHTS[k],
    0,
  );
  const total = Object.values(SALES_MATCH_FIELD_WEIGHTS).reduce((s, w) => s + w, 0);
  if (company !== COMPANY_WEIGHT_SUM || profile !== PROFILE_WEIGHT_SUM || total !== 100) {
    throw new Error(
      `A5: trọng số matching Sales phải 83+17=100 (nhận ${company}+${profile}=${total})`,
    );
  }
}

assertSalesMatchWeights();

function assertProductCatalogAlignment(): void {
  if (PRODUCTS_SOLD.length !== PRODUCT_MATCH_CODES.length) {
    throw new Error(
      `Catalog sản phẩm lệch JSON matching (${PRODUCTS_SOLD.length} vs ${PRODUCT_MATCH_CODES.length})`,
    );
  }
  for (let i = 0; i < PRODUCTS_SOLD.length; i += 1) {
    const jsonName = PRODUCT_MATCH_NAMES[PRODUCT_MATCH_CODES[i]];
    const formName = PRODUCTS_SOLD[i];
    const a = norm(jsonName);
    const b = norm(formName);
    if (a !== b && !a.includes(b) && !b.includes(a)) {
      throw new Error(`Sản phẩm [${i}] lệch JSON (${jsonName}) vs form (${formName})`);
    }
  }
}

assertProductCatalogAlignment();

// ---------------------------------------------------------------------------
// C · Ngành — 12 nhóm → 6 cụm (C1) + ma trận 6×6 (C4)
// ---------------------------------------------------------------------------

export type IndustryCluster = 1 | 2 | 3 | 4 | 5 | 6;

/** C1: {1:1, 5:1, 6:1, 7:1, 2:2, 3:2, 9:2, 4:3, 10:3, 8:4, 12:5, 11:6} */
export const INDUSTRY_GROUP_CLUSTER: Record<Exclude<IndustryGroup, 'Khác'>, IndustryCluster> = {
  'Máy móc & Thiết bị sản xuất': 1,
  'Cơ khí & Chế tạo máy': 1,
  'Thiết bị & Vật tư MRO': 1,
  'Thủy lực & Khí nén': 1,
  'Tự động hóa & Điều khiển': 2,
  'Điện & Năng lượng công nghiệp': 2,
  'Đo lường & Thiết bị công nghiệp': 2,
  'HVAC & Cơ điện M&E': 3,
  'Nhà thầu công nghiệp & EPC': 3,
  'Dầu mỡ nhờn & Hóa chất công nghiệp': 4,
  'Logistics & Thiết bị kho vận': 5,
  'Nhà máy & Sản xuất công nghiệp': 6,
};

/**
 * C4 — đối xứng. Đường chéo 100 không dùng khi cùng cụm khác nhóm (C3).
 * Hàng/cột: cụm 1 … 6.
 */
export const INDUSTRY_CLUSTER_MATRIX = INDUSTRY_CLUSTER_SIMILARITY_MATRIX;

/**
 * 25 sản phẩm catalog (trừ Khác) → đúng 12 nhóm ngành trong INDUSTRY_CATALOG.
 * Cụm P2 = C1(nhóm). Neo ngành chi tiết ghi trong PRODUCT_CATALOG_ANCHORS (test).
 *
 * Không map “Máy nén khí” → “Dầu máy nén khí” (Hóa chất, cụm 4).
 */
export const PRODUCT_INDUSTRY_GROUP: Record<
  Exclude<ProductSold, 'Thiết bị công nghiệp khác'>,
  Exclude<IndustryGroup, 'Khác'>
> = {
  'Máy nén khí': 'Thủy lực & Khí nén',
  'Máy gia công CNC': 'Cơ khí & Chế tạo máy',
  'Máy cắt laser': 'Cơ khí & Chế tạo máy',
  'Máy chấn / máy dập': 'Cơ khí & Chế tạo máy',
  'Máy hàn': 'Cơ khí & Chế tạo máy',
  'Máy ép': 'Máy móc & Thiết bị sản xuất',
  'Dây chuyền sản xuất': 'Máy móc & Thiết bị sản xuất',
  'Bơm công nghiệp': 'Thủy lực & Khí nén',
  'Van công nghiệp': 'Thiết bị & Vật tư MRO',
  'Hệ thống đường ống': 'Thiết bị & Vật tư MRO',
  'Máy phát điện': 'Điện & Năng lượng công nghiệp',
  'Robot công nghiệp': 'Tự động hóa & Điều khiển',
  'PLC / HMI': 'Tự động hóa & Điều khiển',
  'Biến tần / Servo': 'Tự động hóa & Điều khiển',
  'Tủ điện': 'Điện & Năng lượng công nghiệp',
  'Thiết bị đo lường / cảm biến': 'Đo lường & Thiết bị công nghiệp',
  Chiller: 'HVAC & Cơ điện M&E',
  'AHU / FCU': 'HVAC & Cơ điện M&E',
  'Hệ thống HVAC': 'HVAC & Cơ điện M&E',
  'Cooling Tower': 'HVAC & Cơ điện M&E',
  'Thiết bị PCCC': 'HVAC & Cơ điện M&E',
  'Hệ thống xử lý nước': 'HVAC & Cơ điện M&E',
  'Hệ thống lọc bụi / xử lý khí': 'HVAC & Cơ điện M&E',
  'Hệ thống M&E / MEP': 'HVAC & Cơ điện M&E',
  'Thiết bị nâng hạ / cầu trục': 'Logistics & Thiết bị kho vận',
};

/** Ngành chi tiết trong catalog dùng làm neo — không phải luôn trùng tên sản phẩm form. */
export const PRODUCT_CATALOG_ANCHORS: Record<
  Exclude<ProductSold, 'Thiết bị công nghiệp khác'>,
  readonly string[]
> = {
  'Máy nén khí': ['Hệ thống khí nén'],
  'Máy gia công CNC': ['CNC'],
  'Máy cắt laser': ['Máy cắt laser'],
  'Máy chấn / máy dập': ['Máy chấn', 'Máy dập'],
  'Máy hàn': ['Hàn'],
  'Máy ép': ['Máy ép nhựa'],
  'Dây chuyền sản xuất': ['Dây chuyền sản xuất'],
  'Bơm công nghiệp': ['Bơm thủy lực'],
  'Van công nghiệp': ['Van công nghiệp'],
  'Hệ thống đường ống': ['Ống công nghiệp', 'Phụ kiện đường ống'],
  'Máy phát điện': ['Máy phát điện'],
  'Robot công nghiệp': ['Robot công nghiệp'],
  'PLC / HMI': ['PLC', 'HMI'],
  'Biến tần / Servo': ['Biến tần', 'Servo'],
  'Tủ điện': ['Tủ điện phân phối'],
  'Thiết bị đo lường / cảm biến': ['Thiết bị đo cơ khí', 'Thiết bị đo áp suất'],
  Chiller: ['Chiller'],
  'AHU / FCU': ['AHU', 'FCU'],
  'Hệ thống HVAC': ['Hệ thống HVAC'],
  'Cooling Tower': ['Cooling Tower'],
  'Thiết bị PCCC': ['PCCC'],
  'Hệ thống xử lý nước': ['Cấp thoát nước'],
  'Hệ thống lọc bụi / xử lý khí': ['Thông gió', 'Hút khói'],
  'Hệ thống M&E / MEP': ['Hệ thống M&E/MEP'],
  'Thiết bị nâng hạ / cầu trục': ['Thiết bị nâng hạ', 'Cầu trục'],
};

function productClustersFromGroups(
  groups: Record<Exclude<ProductSold, 'Thiết bị công nghiệp khác'>, Exclude<IndustryGroup, 'Khác'>>,
): Record<Exclude<ProductSold, 'Thiết bị công nghiệp khác'>, IndustryCluster> {
  const out = {} as Record<Exclude<ProductSold, 'Thiết bị công nghiệp khác'>, IndustryCluster>;
  for (const product of Object.keys(groups) as Array<
    Exclude<ProductSold, 'Thiết bị công nghiệp khác'>
  >) {
    out[product] = INDUSTRY_GROUP_CLUSTER[groups[product]];
  }
  return out;
}

/** P2 — cụm sản phẩm = C1 của nhóm ngành catalog. */
export const PRODUCT_CLUSTER = productClustersFromGroups(PRODUCT_INDUSTRY_GROUP);

const DEAL_MATRIX_KEYS = [
  DealType.Equipment,
  DealType.Consumables,
  DealType.Service,
  DealType.TechnicalSolution,
  DealType.Project,
  DealType.Other,
] as const;

/** E2 — giải pháp 6×6 đối xứng. Ô Khác lấy từ JSON (H1/H2). */
export const DEAL_TYPE_MATRIX = DEAL_TYPE_SIMILARITY_MATRIX;

/**
 * E3 — khu vực CÓ HƯỚNG: hàng = CV, cột = JD.
 * Thứ tự: Bắc, Trung, Nam, Toàn quốc, Quốc tế, Khác.
 */
export const REGION_MATRIX_DIRECTED = REGION_SIMILARITY_MATRIX;

const SEGMENT_KEYS = CUSTOMER_SEGMENTS;

/** Nhóm KH 8×8 chính thức (JSON 15.09.2026). */
export const CUSTOMER_SEGMENT_MATRIX = CUSTOMER_SEGMENT_SIMILARITY_MATRIX;

/** E4 — 5 khâu cốt lõi 70% + 7 khâu hỗ trợ 30%. */
export const SELLING_STAGE_CORE: readonly SellingStage[] = [
  'Tìm kiếm khách hàng',
  'Khảo sát & xác định nhu cầu',
  'Xây dựng giải pháp / phương án',
  'Đàm phán & xử lý phản đối',
  'Chốt hợp đồng',
];

export const SELLING_STAGE_SUPPORT: readonly SellingStage[] = [
  'Tiếp cận & tạo cuộc hẹn',
  'Tư vấn sản phẩm / dịch vụ',
  'Lập & gửi báo giá',
  'Thuyết trình / trình bày giải pháp',
  'Theo dõi triển khai / giao hàng',
  'Thu hồi công nợ',
  'Chăm sóc khách hàng & bán thêm',
];

const CORE_SET = new Set<string>(SELLING_STAGE_CORE);
const SUPPORT_SET = new Set<string>(SELLING_STAGE_SUPPORT);
const KHAC_RE = /^(khac|khác|other)$/i;

const JD_KEY_TO_FIELD: Partial<Record<JdSalesFieldKey, SalesMatchFieldCode>> = {
  title: 'jd01a',
  industries: 'jd02',
  location: 'jd04',
  experienceBand: 'jd05',
  salary: 'jd06',
  productsSold: 'jd09',
  customerSegments: 'jd10',
  dealTypes: 'jd11',
  sellingStages: 'jd12',
  marketsCovered: 'jd13',
  educationLevel: 'jd14',
  educationMajor: 'jd15',
  languages: 'jd16',
  driverLicenses: 'jd17',
  travelAbility: 'jd18',
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface SalesMatchJdInput {
  title?: string | null;
  industries: string[];
  location?: string | null;
  experienceBand?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  productsSold: string[];
  customerSegments: string[];
  dealTypes: string[];
  sellingStages: string[];
  marketsCovered: string[];
  educationLevel?: string | null;
  educationMajor?: string | null;
  languages: string[];
  driverLicenses: string[];
  travelAbility?: string | null;
  hardFilters?: JdSalesFieldKey[];
  /** Câu C — mặc định 85 khi lọc cứng ngành. */
  industryHardMinS?: 85 | 100;
}

export interface SalesMatchCompanyInput {
  ten: string;
  jobTitle?: string | null;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  dealTypes: string[];
  sellingStages: string[];
  marketsCovered: string[];
  startYear?: number | null;
  endYear?: number | null;
  isCurrent?: boolean;
}

export interface SalesMatchProfileInput {
  desiredPositions: string[];
  desiredLocations: string[];
  currentCity?: string | null;
  currentPosition?: string | null;
  totalExperienceYears?: number | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedOte?: number | null;
  educationLevel?: string | null;
  educationMajor?: string | null;
  languages: string[];
  languageSkills?: LanguageSkill[];
  driverLicenses: string[];
  travelAbility?: string | null;
  /** Khi chưa có dòng công ty — lấy tiêu chí Sales ở hồ sơ. */
  industriesExperienced?: string[];
  productsSold?: string[];
  customerSegments?: string[];
  dealTypes?: string[];
  sellingStages?: string[];
  marketsCovered?: string[];
}

export interface ScoreSalesMatchInput {
  jd: SalesMatchJdInput;
  profile: SalesMatchProfileInput;
  companies: SalesMatchCompanyInput[];
  /** G2/G3 — mặc định năm hiện tại; test truyền cố định. */
  asOfYear?: number;
}

// ---------------------------------------------------------------------------
// Lookups (C, D, E, H)
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isKhacValue(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim();
  if (!t) return false;
  if (KHAC_RE.test(t)) return true;
  if (t === 'Thiết bị công nghiệp khác') return true;
  if (t === DealType.Other || t === 'other') return true;
  return false;
}

/** H1 khi hai bên Khác; H2 khi một bên Khác. */
export function khacSimilarityH1H2(a: string, b: string): number | null {
  const ka = isKhacValue(a);
  const kb = isKhacValue(b);
  if (ka && kb) return SALES_MATCH_CONSTANTS.KHAC_GAP_KHAC;
  if (ka || kb) return SALES_MATCH_CONSTANTS.MOT_BEN_KHAC;
  return null;
}

export function industryGroupOf(raw: string): IndustryGroup | null {
  const n = normalizeIndustry(raw);
  if (n) return n;
  return findIndustryGroupBySub(raw);
}

export function industryClusterOf(raw: string): IndustryCluster | null {
  const g = industryGroupOf(raw);
  if (!g || g === 'Khác') return null;
  return INDUSTRY_GROUP_CLUSTER[g];
}

/** C2–C4 cho một cặp ngành. Ô Khác ngành = 30 (PDF ngành 15.09). */
export function industryPairSimilarityC(cv: string, jd: string): number {
  if (isKhacValue(cv) || isKhacValue(jd)) return SALES_MATCH_CONSTANTS.KHAC_GAP_KHAC;
  const gv = industryGroupOf(cv);
  const gj = industryGroupOf(jd);
  if (!gv || !gj) return 0;
  if (gv === 'Khác' || gj === 'Khác') return SALES_MATCH_CONSTANTS.KHAC_GAP_KHAC;
  if (gv === gj) return 100; // C2
  const cvC = INDUSTRY_GROUP_CLUSTER[gv];
  const jdC = INDUSTRY_GROUP_CLUSTER[gj];
  if (cvC === jdC) return SALES_MATCH_CONSTANTS.CUNG_CUM_KHAC_NGANH; // C3
  return INDUSTRY_CLUSTER_MATRIX[cvC - 1][jdC - 1]; // C4
}

/** C5 — max trên mọi cặp. */
export function industrySimilarityC5(cvList: string[], jdList: string[]): number {
  if (!jdList.length) return 100; // F3 khi gọi kèm skip
  if (!cvList.length) return 0; // H3
  let best = 0;
  for (const cv of cvList) {
    for (const jd of jdList) {
      best = Math.max(best, industryPairSimilarityC(cv, jd));
    }
  }
  return best;
}

/** D1: K = 1 − α × (1 − S/100). D6: không làm tròn. */
export function industryLeakageK_D1(industryS: number, alpha: number): number {
  if (alpha <= 0) return 1;
  return 1 - alpha * (1 - industryS / 100);
}

function catalogProductOf(raw: string): ProductSold | null {
  const t = raw.trim();
  if ((PRODUCTS_SOLD as readonly string[]).includes(t)) return t as ProductSold;
  const n = norm(t);
  const byCode = PRODUCT_MATCH_CODES.find((c) => c.toLowerCase() === n);
  if (byCode) {
    const i = PRODUCT_MATCH_CODES.indexOf(byCode);
    return PRODUCTS_SOLD[i] ?? null;
  }
  const byJsonName = PRODUCT_MATCH_CODES.find((c) => norm(PRODUCT_MATCH_NAMES[c]) === n);
  if (byJsonName) {
    const i = PRODUCT_MATCH_CODES.indexOf(byJsonName);
    return PRODUCTS_SOLD[i] ?? null;
  }
  const hit = PRODUCTS_SOLD.find((p) => norm(p) === n);
  if (hit) return hit;
  return (
    PRODUCTS_SOLD.find(
      (p) =>
        p !== 'Thiết bị công nghiệp khác' && (norm(p).includes(n) || n.includes(norm(p))),
    ) ?? null
  );
}

function productMatrixIndex(raw: string): number | null {
  const cat = catalogProductOf(raw);
  if (cat) {
    const i = PRODUCTS_SOLD.indexOf(cat);
    return i >= 0 ? i : null;
  }
  return isKhacValue(raw) ? PRODUCT_MATCH_CODES.length - 1 : null;
}

function productClusterOf(raw: string): IndustryCluster | null {
  const cat = catalogProductOf(raw);
  if (!cat || cat === 'Thiết bị công nghiệp khác') return null;
  return PRODUCT_CLUSTER[cat];
}

export function productPairSimilarity(cv: string, jd: string): number {
  const i = productMatrixIndex(cv);
  const j = productMatrixIndex(jd);
  if (i != null && j != null) {
    return PRODUCT_SIMILARITY_MATRIX[i][j];
  }
  const khac = khacSimilarityH1H2(cv, jd);
  if (khac != null) return khac;
  if (norm(cv) === norm(jd)) return 100;
  const cc = productClusterOf(cv);
  const jc = productClusterOf(jd);
  if (cc != null && jc != null) {
    if (cc === jc) return SALES_MATCH_CONSTANTS.CUNG_CUM_KHAC_NGANH;
    return INDUSTRY_CLUSTER_MATRIX[cc - 1][jc - 1];
  }
  return SALES_MATCH_CONSTANTS.MOT_BEN_KHAC;
}

function segmentIndex(raw: string): number | null {
  const n = normalizeCustomerSegment(raw) ?? (CUSTOMER_SEGMENTS as readonly string[]).find(
    (s) => norm(s) === norm(raw),
  );
  if (!n) return isKhacValue(raw) ? SEGMENT_KEYS.length - 1 : null;
  const i = SEGMENT_KEYS.indexOf(n as CustomerSegment);
  return i >= 0 ? i : null;
}

export function segmentPairSimilarity(cv: string, jd: string): number {
  const khac = khacSimilarityH1H2(cv, jd);
  if (khac != null) return khac;
  const i = segmentIndex(cv);
  const j = segmentIndex(jd);
  if (i == null || j == null) return 0;
  if (i === SEGMENT_KEYS.length - 1 || j === SEGMENT_KEYS.length - 1) {
    return khacSimilarityH1H2(SEGMENT_KEYS[i], SEGMENT_KEYS[j]) ?? CUSTOMER_SEGMENT_MATRIX[i][j];
  }
  return CUSTOMER_SEGMENT_MATRIX[i][j];
}

function dealIndex(raw: string): number | null {
  const n = normalizeDealTypeValue(raw);
  if (!n) return isKhacValue(raw) ? DEAL_MATRIX_KEYS.length - 1 : null;
  const canonical =
    n === DealType.Rental
      ? DealType.Service
      : n === DealType.Standard
        ? DealType.Equipment
        : n === DealType.Solution
          ? DealType.TechnicalSolution
          : n;
  const i = DEAL_MATRIX_KEYS.indexOf(canonical as (typeof DEAL_MATRIX_KEYS)[number]);
  return i >= 0 ? i : null;
}

export function dealPairSimilarity(cv: string, jd: string): number {
  const khac = khacSimilarityH1H2(cv, jd);
  if (khac != null) return khac;
  const i = dealIndex(cv);
  const j = dealIndex(jd);
  if (i == null || j == null) return 0;
  if (i === DEAL_MATRIX_KEYS.length - 1 || j === DEAL_MATRIX_KEYS.length - 1) {
    return khacSimilarityH1H2(DEAL_MATRIX_KEYS[i], DEAL_MATRIX_KEYS[j]) ?? DEAL_TYPE_MATRIX[i][j];
  }
  return DEAL_TYPE_MATRIX[i][j];
}

function regionIndex(raw: string): number | null {
  const t = raw.trim();
  const hit = MARKET_REGIONS.find((r) => r === t || norm(r) === norm(t));
  if (hit) return MARKET_REGIONS.indexOf(hit as MarketRegion);
  return isKhacValue(raw) ? MARKET_REGIONS.length - 1 : null;
}

/** E3 — M[cv][jd], không đối xứng. */
export function regionPairSimilarityE3(cv: string, jd: string): number {
  const khac = khacSimilarityH1H2(cv, jd);
  if (khac != null) return khac;
  const i = regionIndex(cv);
  const j = regionIndex(jd);
  if (i == null || j == null) return 0;
  if (i === MARKET_REGIONS.length - 1 || j === MARKET_REGIONS.length - 1) {
    return khacSimilarityH1H2(MARKET_REGIONS[i], MARKET_REGIONS[j]) ?? REGION_MATRIX_DIRECTED[i][j];
  }
  return REGION_MATRIX_DIRECTED[i][j];
}

/**
 * E1 — với mỗi mục JD: max trên các mục CV; lấy top min(len(JD), 3); trung bình.
 */
export function multiSelectCoverageE1(
  cvList: string[],
  jdList: string[],
  pair: (cv: string, jd: string) => number,
): number {
  if (!jdList.length) return 0;
  const scores = jdList.map((j) => {
    if (!cvList.length) return 0;
    return Math.max(...cvList.map((c) => pair(c, j)));
  });
  scores.sort((a, b) => b - a);
  const k = Math.min(jdList.length, SALES_MATCH_CONSTANTS.MAX_CHON_HO_SO);
  const slice = scores.slice(0, k);
  return slice.reduce((s, n) => s + n, 0) / k;
}

export function maxPairSimilarity(
  cvList: string[],
  jdList: string[],
  pair: (cv: string, jd: string) => number,
): number {
  if (!jdList.length) return 0;
  if (!cvList.length) return 0;
  let best = 0;
  for (const cv of cvList) {
    for (const jd of jdList) {
      best = Math.max(best, pair(cv, jd));
    }
  }
  return best;
}

function normalizeStages(list: string[]): SellingStage[] {
  const out: SellingStage[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const n = normalizeSellingStage(raw) ?? ((SELLING_STAGES as readonly string[]).includes(raw.trim())
      ? (raw.trim() as SellingStage)
      : null);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** E4 — 70% cốt lõi + 30% hỗ trợ; nhóm JD trống → dồn 100% sang nhóm còn lại. */
export function sellingStageScoreE4(cvList: string[], jdList: string[]): number {
  const cv = new Set(normalizeStages(cvList));
  const jd = normalizeStages(jdList);
  const jdCore = jd.filter((s) => CORE_SET.has(s));
  const jdSupport = jd.filter((s) => SUPPORT_SET.has(s));
  const ratio = (need: SellingStage[]) => {
    if (!need.length) return null;
    const hit = need.filter((s) => cv.has(s)).length;
    return hit / need.length;
  };
  const core = ratio(jdCore);
  const support = ratio(jdSupport);
  if (core == null && support == null) return 0;
  if (core == null) return (support ?? 0) * 100;
  if (support == null) return core * 100;
  const coreW = SALES_MATCH_CONSTANTS.TY_TRONG_KHAU_COT_LOI;
  return (coreW * core + (1 - coreW) * support) * 100;
}

/** 4 bậc chức danh v1.1: Nhân viên · Trưởng nhóm · Trưởng phòng · Giám đốc. */
export type SalesTitleRank = 0 | 1 | 2 | 3;

const TITLE_RANK_BY_CATALOG: Record<(typeof DESIRED_POSITIONS)[number], SalesTitleRank> = {
  'Nhân viên kinh doanh': 0,
  'Trưởng nhóm kinh doanh': 1,
  'Trưởng phòng kinh doanh': 2,
  'Giám đốc kinh doanh': 3,
};

export function salesTitleRankOf(raw: string): SalesTitleRank | null {
  const t = raw.trim();
  if (!t) return null;
  const catalog = DESIRED_POSITIONS.find((p) => p === t || norm(p) === norm(t));
  if (catalog) return TITLE_RANK_BY_CATALOG[catalog];
  const legacy = LEGACY_DESIRED_POSITION_MAP[t] ?? LEGACY_DESIRED_POSITION_MAP[raw];
  if (legacy) return TITLE_RANK_BY_CATALOG[legacy];
  const n = norm(t);
  if (/(giam doc|director|gd kd|\bgd\b)/.test(n)) return 3;
  if (/(truong phong|sales manager|area sales|\basm\b)/.test(n)) return 2;
  if (/(quan ly san pham|product manager|\bpm\b)/.test(n)) return 2;
  if (/(truong nhom|supervisor|team lead|truong bo phan)/.test(n)) return 1;
  if (/(nhan vien|nvkd|sales executive|sales engineer|sales rep)/.test(n)) return 0;
  return null;
}

function titleRankPairS(
  jdRank: SalesTitleRank | null,
  cvRank: SalesTitleRank | null,
  mode: 'jd01a' | 'jd01b',
): { S: number; canh_bao?: string } {
  if (jdRank == null || cvRank == null) {
    if (mode === 'jd01b') {
      return { S: 50, canh_bao: 'chuc_danh_chua_chuan_hoa' };
    }
    return { S: 50, canh_bao: 'chuc_danh_chua_chuan_hoa' };
  }
  if (mode === 'jd01a') {
    const diff = Math.abs(jdRank - cvRank);
    if (diff === 0) return { S: 100 };
    if (diff === 1) return { S: 70 };
    if (diff === 2) return { S: 40 };
    return { S: 20 };
  }
  if (cvRank >= jdRank) return { S: 100 };
  const down = jdRank - cvRank;
  if (down === 1) return { S: 70 };
  if (down === 2) return { S: 40 };
  return { S: 20 };
}

export function desiredTitleSimilarityS(jdTitle: string, cvTitles: string[]): {
  S: number;
  canh_bao?: string;
} {
  if (!jdTitle.trim()) return { S: 0 };
  const usable = cvTitles.map((t) => t.trim()).filter(Boolean);
  if (!usable.length) return { S: 0 };
  const jdRank = salesTitleRankOf(jdTitle);
  let best: { S: number; canh_bao?: string } = { S: 0 };
  for (const title of usable) {
    const row = titleRankPairS(jdRank, salesTitleRankOf(title), 'jd01a');
    if (row.S > best.S) best = row;
  }
  return best;
}

export function pastTitleSimilarityS(jdTitle: string, cvTitle: string): {
  S: number;
  canh_bao?: string;
} {
  if (!jdTitle.trim()) return { S: 0 };
  if (!cvTitle.trim()) return { S: 0 };
  return titleRankPairS(salesTitleRankOf(jdTitle), salesTitleRankOf(cvTitle), 'jd01b');
}

function splitJoined(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isNationwidePlace(raw: string): boolean {
  const n = norm(raw);
  return n === 'toan quoc' || n === 'ca nuoc';
}

function isInternationalPlace(raw: string): boolean {
  return norm(raw) === 'quoc te';
}

type PlaceToken =
  | { kind: 'nation' }
  | { kind: 'world' }
  | { kind: 'region'; region: string }
  | { kind: 'province'; region: string; name: string }
  | { kind: 'other'; name: string };

function parsePlaceToken(raw: string): PlaceToken {
  const t = raw.trim();
  if (isNationwidePlace(t)) return { kind: 'nation' };
  if (isInternationalPlace(t) || isKhacValue(t)) {
    return isInternationalPlace(t) ? { kind: 'world' } : { kind: 'other', name: t };
  }
  const region = vnMacroRegionOf(t);
  const n = norm(t);
  if (n === 'mien bac' || n === 'mien trung' || n === 'mien nam') {
    return { kind: 'region', region: region ?? t };
  }
  if (region && (n.startsWith('tinh') || n.startsWith('thanh pho') || n.length >= 3)) {
    const looksRegionOnly = n === 'mien bac' || n === 'mien trung' || n === 'mien nam';
    if (!looksRegionOnly && !/^mien /.test(n)) {
      return { kind: 'province', region, name: t };
    }
  }
  if (region) return { kind: 'region', region };
  return { kind: 'other', name: t };
}

function sameProvince(a: string, b: string): boolean {
  const pa = resolveVnProvince2025(a);
  const pb = resolveVnProvince2025(b);
  if (pa && pb) return pa === pb;
  return norm(a) === norm(b);
}

/** jd04 v1.2 — 100 giao tỉnh/vùng, 50 cùng miền khác tỉnh, 10 khác miền. Bỏ bảng tỉnh liền kề. */
function placePairS(jd: PlaceToken, cv: PlaceToken): number {
  const sameMien = SALES_MATCH_CONSTANTS.JD04_CUNG_MIEN;
  const khacMien = SALES_MATCH_CONSTANTS.JD04_KHAC_MIEN;
  if (jd.kind === 'nation' && cv.kind !== 'world') return 100;
  if (cv.kind === 'nation' && jd.kind !== 'world') return 100;
  if (jd.kind === 'world' || cv.kind === 'world') {
    return jd.kind === 'world' && cv.kind === 'world' ? 100 : khacMien;
  }
  if (jd.kind === 'other' || cv.kind === 'other') {
    if (jd.kind === 'other' && cv.kind === 'other' && norm(jd.name) === norm(cv.name)) return 100;
    return khacMien;
  }
  if (jd.kind === 'region' && cv.kind === 'region') {
    return jd.region === cv.region ? 100 : khacMien;
  }
  if (jd.kind === 'region' && cv.kind === 'province') {
    return jd.region === cv.region ? 100 : khacMien;
  }
  if (jd.kind === 'province' && cv.kind === 'region') {
    return jd.region === cv.region ? 100 : khacMien;
  }
  if (jd.kind === 'province' && cv.kind === 'province') {
    if (sameProvince(jd.name, cv.name)) return 100;
    return jd.region === cv.region ? sameMien : khacMien;
  }
  return khacMien;
}

export function locationSimilarityS(jdLocation: string, cvPlaces: string[]): number {
  const need = splitJoined(jdLocation);
  if (!need.length) return 0;
  const have = cvPlaces.map((s) => s.trim()).filter(Boolean);
  if (!have.length) return 0;
  const jdTokens = need.map(parsePlaceToken);
  const cvTokens = have.flatMap((p) => {
    if (p.includes('/')) return p.split('/').map((x) => parsePlaceToken(x.trim()));
    return [parsePlaceToken(p)];
  });
  let best = 0;
  for (const j of jdTokens) {
    for (const c of cvTokens) {
      best = Math.max(best, placePairS(j, c));
    }
  }
  return best;
}

export function experienceSimilarityS(
  jobBand: string | null | undefined,
  years: number | null | undefined,
): number {
  const required = experienceBandToYears(jobBand);
  if (!required) return 0;
  if (years == null || !Number.isFinite(years)) return 0;
  const need = required.min;
  if (years >= need) return 100;
  const gap = need - years;
  if (gap < 1) return 80;
  if (gap <= 2) return 60;
  return 30;
}

export function salarySimilarityS(
  jobMin: number | null | undefined,
  jobMax: number | null | undefined,
  candMin: number | null | undefined,
  candMax: number | null | undefined,
  candOte: number | null | undefined,
): number {
  const ceiling = jobMax != null && jobMax > 0 ? jobMax : jobMin != null && jobMin > 0 ? jobMin : null;
  if (ceiling == null) return 0;
  const expected = candMax ?? candOte ?? candMin ?? null;
  const minimum = candMin ?? candOte ?? candMax ?? null;
  if (expected == null && minimum == null) return 0;
  const kyVong = expected ?? minimum ?? 0;
  const toiThieu = minimum ?? expected ?? 0;
  if (kyVong <= ceiling) return 100;
  if (toiThieu <= ceiling) return 80;
  if (toiThieu < ceiling * 1.15) return 50;
  return 10;
}

function educationRank(level: string | null | undefined): number | null {
  if (!level?.trim()) return null;
  const i = EDUCATION_LEVELS.findIndex((x) => x === level || norm(x) === norm(level));
  return i >= 0 ? i : null;
}

export function educationSimilarityS(jd: string | null | undefined, cv: string | null | undefined): number {
  const j = educationRank(jd);
  const c = educationRank(cv);
  if (j == null) return 0;
  if (c == null) return 0;
  if (c >= j) return 100;
  if (c === j - 1) return 60;
  return 20;
}

type MajorBlock = 'ky_thuat' | 'kinh_te' | 'khac';

function majorKey(raw: string): string {
  return norm(raw).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Từ khoá nhiều chữ: tìm cụm. Một chữ: khớp token để tránh "mỏ" dính "môi trường". */
function containsMajorKeyword(hay: string, keyword: string): boolean {
  const k = majorKey(keyword);
  if (!k) return false;
  if (k.includes(' ')) return hay.includes(k);
  return new RegExp(`(?:^|\\s)${escapeRegExp(k)}(?:\\s|$)`).test(hay);
}

export function majorBlockOf(raw: string): MajorBlock {
  const hay = majorKey(raw);
  if (!hay) return 'khac';
  let best: { len: number; block: MajorBlock } | null = null;
  for (const kw of MAJOR_KEYWORDS_KY_THUAT) {
    if (!containsMajorKeyword(hay, kw)) continue;
    const len = majorKey(kw).length;
    if (!best || len > best.len) best = { len, block: 'ky_thuat' };
  }
  for (const kw of MAJOR_KEYWORDS_KINH_TE) {
    if (!containsMajorKeyword(hay, kw)) continue;
    const len = majorKey(kw).length;
    if (!best || len > best.len) best = { len, block: 'kinh_te' };
  }
  return best?.block ?? 'khac';
}

/** jd15 v1.2 — 100 trùng tên sau chuẩn hoá, 60 cùng khối từ khoá, 25 khác khối / không nhận ra. */
export function majorSimilarityS(jd: string | null | undefined, cv: string | null | undefined): number {
  const a = (jd ?? '').trim();
  const b = (cv ?? '').trim();
  if (!a) return 0;
  if (!b) return 0;
  if (majorKey(a) === majorKey(b)) return 100;
  if (majorBlockOf(a) === majorBlockOf(b) && majorBlockOf(a) !== 'khac') {
    return SALES_MATCH_CONSTANTS.JD15_CUNG_KHOI;
  }
  return SALES_MATCH_CONSTANTS.JD15_KHAC_HOAC_KHONG_NHAN;
}

function listCoverageS(jdList: string[], cvList: string[]): number {
  const need = jdList.map((s) => s.trim()).filter((s) => s && s !== 'Chưa có');
  if (!need.length) return 0;
  if (!cvList.length) return 0;
  let hit = 0;
  for (const n of need) {
    if (isKhacValue(n)) {
      if (cvList.some((c) => isKhacValue(c))) hit += 1;
      continue;
    }
    const nn = norm(n);
    if (cvList.some((c) => norm(c) === nn || norm(c).includes(nn) || nn.includes(norm(c)))) {
      hit += 1;
    }
  }
  return (100 * hit) / need.length;
}

const LANG_LEVEL_ORDER: LanguageSkillLevel[] = ['basic', 'intermediate', 'good', 'fluent'];

function languageLevelRank(raw: string | null | undefined): number {
  if (!raw) return 1;
  const v = raw.trim().toLowerCase();
  if (v === 'basic' || v === 'co ban' || v === 'cơ bản') return 0;
  if (v === 'intermediate' || v === 'kha' || v === 'khá' || v === 'conversational') return 1;
  if (v === 'good' || v === 'tot' || v === 'tốt' || v === 'business') return 2;
  if (v === 'fluent' || v === 'thanh thao' || v === 'thành thạo') return 3;
  const hit = LANGUAGE_SKILL_LEVELS.find((l) => l.value === v || norm(l.label) === norm(raw));
  if (hit) return LANG_LEVEL_ORDER.indexOf(hit.value);
  return 1;
}

function parseJdLanguage(raw: string): { language: string; levelRank: number } {
  const t = raw.trim();
  const m = t.match(/^(.*?)(?:\s*[(|:–-]\s*([^)|]+)\s*\)?)?$/);
  const language = (m?.[1] ?? t).trim();
  const levelRaw = m?.[2]?.trim();
  return { language, levelRank: languageLevelRank(levelRaw ?? 'intermediate') };
}

export function languageSimilarityS(
  jdList: string[],
  cvNames: string[],
  cvSkills?: LanguageSkill[],
): number {
  const need = jdList.map((s) => s.trim()).filter(Boolean);
  if (!need.length) return 0;
  const skills =
    cvSkills?.filter((s) => s.language?.trim()) ??
    cvNames.filter(Boolean).map((language) => ({
      language,
      workUsage: 'intermediate' as LanguageSkillLevel,
      listening: null,
      speaking: null,
      reading: null,
      writing: null,
      technicalManualReading: null,
    }));
  if (!skills.length) return 0;
  const perLang: number[] = need.map((req) => {
    const jd = parseJdLanguage(req);
    const cv = skills.find((s) => {
      const nn = norm(s.language);
      const jn = norm(jd.language);
      return nn === jn || nn.includes(jn) || jn.includes(nn);
    });
    if (!cv) return 0;
    const cvRank = languageLevelRank(languageWorkUsage(cv));
    if (cvRank >= jd.levelRank) return 100;
    if (jd.levelRank - cvRank === 1) return 60;
    return 30;
  });
  return perLang.reduce((s, n) => s + n, 0) / perLang.length;
}

function travelRank(v: string | null | undefined): number | null {
  switch (v) {
    case TravelAbility.None:
    case 'none':
      return 0;
    case TravelAbility.UpTo25:
    case 'up_to_25':
      return 1;
    case TravelAbility.From25To50:
    case '25_50':
      return 2;
    case TravelAbility.Over50:
    case 'over_50':
      return 3;
    default:
      return v?.trim() ? 0 : null;
  }
}

export function travelSimilarityS(jd: string | null | undefined, cv: string | null | undefined): number {
  const j = travelRank(jd);
  const c = travelRank(cv);
  if (j == null) return 0;
  if (c == null) return 0;
  if (c >= j) return 100;
  if (j - c === 1) return 50;
  return 0;
}

export function companyYearsG2(
  company: { startYear?: number | null; endYear?: number | null; isCurrent?: boolean },
  asOfYear: number,
): number {
  const start = company.startYear;
  if (start == null || !Number.isFinite(start)) return 0;
  const end = company.isCurrent ? asOfYear : (company.endYear ?? asOfYear);
  const raw = end - start;
  if (raw <= 0) return company.isCurrent || company.endYear === start ? 0.5 : 0;
  return raw;
}

/** G2: D = 0,5 + 0,5 × min(1, năm/3). */
export function durationFactorG2(years: number): number {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, years) / 3);
}

/** G3: dưới 2 → 1,00 · 2–5 → 0,90 · 5–8 → 0,80 · trên 8 → 0,65. */
export function recencyFactorG3(
  company: { isCurrent?: boolean; endYear?: number | null },
  asOfYear: number,
): number {
  if (company.isCurrent) return 1;
  const end = company.endYear;
  if (end == null || !Number.isFinite(end)) return 1;
  const since = asOfYear - end;
  if (since < 2) return 1;
  if (since < 5) return 0.9;
  if (since < 8) return 0.8;
  return 0.65;
}

/** F2: điểm_khối = tổng_điểm / tổng_trọng_số_còn_lại × 100. */
export function renormalizeBlockF2(sumPoints: number, remainingWeight: number): number {
  if (remainingWeight <= 0) return 0;
  return (sumPoints / remainingWeight) * 100;
}

function round1H6(n: number): number {
  return Math.round(n * 10) / 10;
}

function isJdFieldFilled(jd: SalesMatchJdInput, field: SalesMatchFieldCode): boolean {
  switch (field) {
    case 'jd01a':
    case 'jd01b':
      return Boolean(jd.title?.trim());
    case 'jd02':
      return jd.industries.length > 0;
    case 'jd04':
      return Boolean(jd.location?.trim());
    case 'jd05':
      return Boolean(jd.experienceBand);
    case 'jd06':
      return (jd.salaryMin != null && jd.salaryMin > 0) || (jd.salaryMax != null && jd.salaryMax > 0);
    case 'jd09':
      return jd.productsSold.length > 0;
    case 'jd10':
      return jd.customerSegments.length > 0;
    case 'jd11':
      return jd.dealTypes.length > 0;
    case 'jd12':
      return jd.sellingStages.length > 0;
    case 'jd13':
      return jd.marketsCovered.length > 0;
    case 'jd14':
      return Boolean(jd.educationLevel);
    case 'jd15':
      return Boolean(jd.educationMajor?.trim());
    case 'jd16':
      return jd.languages.length > 0;
    case 'jd17':
      return jd.driverLicenses.filter((l) => l && l !== 'Chưa có').length > 0;
    case 'jd18':
      return Boolean(jd.travelAbility);
    default:
      return false;
  }
}

function profileYears(profile: SalesMatchProfileInput, companies: SalesMatchCompanyInput[], asOfYear: number): number | null {
  if (profile.totalExperienceYears != null && Number.isFinite(profile.totalExperienceYears)) {
    return profile.totalExperienceYears;
  }
  const sum = companies.reduce((s, c) => s + companyYearsG2(c, asOfYear), 0);
  return sum > 0 ? sum : null;
}

interface FieldScore {
  field: SalesMatchFieldCode;
  S: number;
  K: number;
  weight: number;
  diem: number;
  canh_bao?: string;
}

function scoreFieldS(
  field: SalesMatchFieldCode,
  jd: SalesMatchJdInput,
  profile: SalesMatchProfileInput,
  company: SalesMatchCompanyInput | null,
  years: number | null,
): { S: number; canh_bao?: string } {
  switch (field) {
    case 'jd01a':
      return desiredTitleSimilarityS(jd.title ?? '', profile.desiredPositions);
    case 'jd01b':
      return pastTitleSimilarityS(jd.title ?? '', company?.jobTitle ?? '');
    case 'jd02':
      return { S: industrySimilarityC5(company?.industries ?? [], jd.industries) };
    case 'jd04':
      return {
        S: locationSimilarityS(
          jd.location ?? '',
          [...profile.desiredLocations, profile.currentCity ?? ''].filter((s) => s.trim()),
        ),
      };
    case 'jd05':
      return { S: experienceSimilarityS(jd.experienceBand, years) };
    case 'jd06':
      return {
        S: salarySimilarityS(
          jd.salaryMin,
          jd.salaryMax,
          profile.expectedSalaryMin,
          profile.expectedSalaryMax,
          profile.expectedOte,
        ),
      };
    case 'jd09':
      return {
        S: multiSelectCoverageE1(company?.productsSold ?? [], jd.productsSold, productPairSimilarity),
      };
    case 'jd10':
      return {
        S: multiSelectCoverageE1(
          company?.customerSegments ?? [],
          jd.customerSegments,
          segmentPairSimilarity,
        ),
      };
    case 'jd11':
      return {
        S: multiSelectCoverageE1(company?.dealTypes ?? [], jd.dealTypes, dealPairSimilarity),
      };
    case 'jd12':
      return { S: sellingStageScoreE4(company?.sellingStages ?? [], jd.sellingStages) };
    case 'jd13':
      return {
        S: multiSelectCoverageE1(
          company?.marketsCovered ?? [],
          jd.marketsCovered,
          regionPairSimilarityE3,
        ),
      };
    case 'jd14':
      return { S: educationSimilarityS(jd.educationLevel, profile.educationLevel) };
    case 'jd15':
      return { S: majorSimilarityS(jd.educationMajor, profile.educationMajor) };
    case 'jd16':
      return { S: languageSimilarityS(jd.languages, profile.languages, profile.languageSkills) };
    case 'jd17':
      return { S: listCoverageS(jd.driverLicenses, profile.driverLicenses) };
    case 'jd18':
      return { S: travelSimilarityS(jd.travelAbility, profile.travelAbility) };
    default:
      return { S: 0 };
  }
}

function applyK(field: SalesMatchFieldCode, industryS: number, jdIndustryEmpty: boolean): number {
  if (field === 'jd02') return 1; // D3
  const alpha = SALES_MATCH_FIELD_ALPHA[field];
  if (alpha <= 0) return 1; // D4 + jd12
  if (jdIndustryEmpty) return 1; // F3
  return industryLeakageK_D1(industryS, alpha);
}

function scoreBlock(
  fields: readonly SalesMatchFieldCode[],
  jd: SalesMatchJdInput,
  profile: SalesMatchProfileInput,
  company: SalesMatchCompanyInput | null,
  years: number | null,
  skippedByHardFilter: Set<SalesMatchFieldCode>,
): { rows: FieldScore[]; remainingWeight: number; sumPoints: number; normalized: number } {
  const jdIndustryEmpty = !isJdFieldFilled(jd, 'jd02');
  const industryS = jdIndustryEmpty
    ? 100
    : industrySimilarityC5(company?.industries ?? [], jd.industries);
  const rows: FieldScore[] = [];
  let remainingWeight = 0;
  let sumPoints = 0;
  for (const field of fields) {
    if (skippedByHardFilter.has(field)) continue; // B3
    if (!isJdFieldFilled(jd, field)) continue; // F1
    const weight = SALES_MATCH_FIELD_WEIGHTS[field];
    remainingWeight += weight;
    const scored = scoreFieldS(field, jd, profile, company, years);
    const S = scored.S;
    const K = applyK(field, industryS, jdIndustryEmpty);
    const diem = (S / 100) * K * weight; // E5
    rows.push({ field, S, K, weight, diem, canh_bao: scored.canh_bao });
    sumPoints += diem;
  }
  return {
    rows,
    remainingWeight,
    sumPoints,
    normalized: renormalizeBlockF2(sumPoints, remainingWeight),
  };
}

function hardFilterFailReasons(
  jd: SalesMatchJdInput,
  profile: SalesMatchProfileInput,
  companies: SalesMatchCompanyInput[],
  years: number | null,
): string[] {
  const reasons: string[] = [];
  for (const key of jd.hardFilters ?? []) {
    const field = JD_KEY_TO_FIELD[key];
    if (!field) continue;
    if (!isJdFieldFilled(jd, field) && key !== 'title') continue;
    let S = 0;
    if (SALES_MATCH_COMPANY_FIELDS.includes(field)) {
      S = Math.max(
        0,
        ...companies.map((c) => scoreFieldS(field, jd, profile, c, years).S),
      );
    } else {
      S = scoreFieldS(field, jd, profile, companies[0] ?? null, years).S;
    }
    if (key === 'title') {
      const a = scoreFieldS('jd01a', jd, profile, null, years).S;
      const b = Math.max(
        0,
        ...companies.map((c) => scoreFieldS('jd01b', jd, profile, c, years).S),
      );
      S = Math.max(a, b);
    }
    const minS =
      key === 'industries'
        ? (jd.industryHardMinS ?? SALES_MATCH_CONSTANTS.CUNG_CUM_KHAC_NGANH)
        : 100;
    if (S < minS) {
      const label = SALES_MATCH_FIELD_LABEL[field] ?? key;
      reasons.push(`${label} (bắt buộc)`);
    }
  }
  return reasons;
}

function skippedHardFilterFields(jd: SalesMatchJdInput): Set<SalesMatchFieldCode> {
  const out = new Set<SalesMatchFieldCode>();
  for (const key of jd.hardFilters ?? []) {
    const field = JD_KEY_TO_FIELD[key];
    if (field) out.add(field);
    if (key === 'title') {
      out.add('jd01a');
      out.add('jd01b');
    }
  }
  return out;
}

function toDetail(row: FieldScore): SalesMatchFieldDetail {
  return {
    truong: row.field,
    label: SALES_MATCH_FIELD_LABEL[row.field],
    S: row.S,
    K: row.K,
    trong_so: row.weight,
    diem: row.diem,
    canh_bao: row.canh_bao,
  };
}

function failResult(ly_do: string[]): SalesMatchResult {
  return {
    diem_phu_hop: null,
    dat_loc_cung: false,
    ly_do_loai: ly_do,
    diem_kinh_nghiem: null,
    diem_chung: null,
    cong_ty_tot_nhat: null,
    thuong_be_day: 0,
    chi_tiet: [],
    khoang_thieu: [],
    canh_bao: [],
  };
}

function ensureCompanies(
  profile: SalesMatchProfileInput,
  companies: SalesMatchCompanyInput[],
): SalesMatchCompanyInput[] {
  if (companies.length) return companies;
  return [
    {
      ten: profile.currentPosition?.trim() || 'Hồ sơ',
      jobTitle: profile.currentPosition,
      industries: profile.industriesExperienced ?? [],
      productsSold: profile.productsSold ?? [],
      customerSegments: profile.customerSegments ?? [],
      dealTypes: profile.dealTypes ?? [],
      sellingStages: profile.sellingStages ?? [],
      marketsCovered: profile.marketsCovered ?? [],
      isCurrent: true,
    },
  ];
}

/** I5 — chấm xác định, không LLM. */
export function scoreSalesMatch(input: ScoreSalesMatchInput): SalesMatchResult {
  const asOfYear = input.asOfYear ?? new Date().getFullYear();
  const companies = ensureCompanies(input.profile, input.companies);
  const years = profileYears(input.profile, companies, asOfYear);
  const skipped = skippedHardFilterFields(input.jd);

  const ly_do = hardFilterFailReasons(input.jd, input.profile, companies, years);
  if (ly_do.length) return failResult(ly_do); // B2

  const profileBlock = scoreBlock(
    SALES_MATCH_PROFILE_FIELDS,
    input.jd,
    input.profile,
    null,
    years,
    skipped,
  );

  const scored = companies.map((company, index) => {
    const block = scoreBlock(
      SALES_MATCH_COMPANY_FIELDS,
      input.jd,
      input.profile,
      company,
      years,
      skipped,
    );
    const P = block.normalized; // G1
    const yrs = companyYearsG2(company, asOfYear);
    const D = durationFactorG2(yrs); // G2
    const R = recencyFactorG3(company, asOfYear); // G3
    const E = P * D * R; // G4
    return { company, index, block, P, D, R, E, yrs };
  });

  scored.sort((a, b) => b.E - a.E || a.index - b.index);
  const best = scored[0]; // G5 theo E, không phải P
  const others = scored.slice(1);

  let B = 0;
  if (others.length) {
    const sum = others.reduce((s, row) => s + (row.E / 100) * row.yrs, 0);
    B =
      SALES_MATCH_CONSTANTS.TRAN_THUONG_BE_DAY *
      Math.min(1, sum / SALES_MATCH_CONSTANTS.NGUONG_BE_DAY_NAM); // G6
  } // H4: 1 công ty → B = 0

  const E_best = best?.E ?? 0;
  const diem_kinh_nghiem = E_best + (100 - E_best) * B; // G7
  const diem_chung = profileBlock.normalized;

  let diem: number;
  if (best && best.block.remainingWeight <= 0 && profileBlock.remainingWeight <= 0) {
    diem = 0;
  } else if (!best || best.block.remainingWeight <= 0) {
    diem = diem_chung;
  } else if (profileBlock.remainingWeight <= 0) {
    diem = diem_kinh_nghiem;
  } else {
    diem =
      (SALES_MATCH_CONSTANTS.KHOI_CONG_TY / 100) * diem_kinh_nghiem +
      (SALES_MATCH_CONSTANTS.KHOI_CHUNG / 100) * diem_chung; // G8
  }

  const chi_tiet = [...(best?.block.rows ?? []), ...profileBlock.rows].map(toDetail);
  const khoang_thieu = chi_tiet.filter((r) => r.S < 50).map((r) => r.truong); // I4
  const canh_bao = [...new Set(chi_tiet.map((r) => r.canh_bao).filter((x): x is string => Boolean(x)))];

  const cong_ty_tot_nhat: SalesMatchCompanySummary | null = best
    ? { ten: best.company.ten, P: best.P, D: best.D, R: best.R, E: best.E }
    : null;

  return {
    diem_phu_hop: round1H6(diem), // H6
    dat_loc_cung: true,
    ly_do_loai: [],
    diem_kinh_nghiem,
    diem_chung,
    cong_ty_tot_nhat,
    thuong_be_day: B,
    chi_tiet,
    khoang_thieu,
    canh_bao,
  };
}

export function salesMatchToExplanation(result: SalesMatchResult): MatchExplanation {
  if (!result.dat_loc_cung) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
      reason: `Không đạt điều kiện bắt buộc: ${result.ly_do_loai.join('; ') || 'lọc cứng'}`,
      criteria: [],
      salesMatch: result,
    };
  }
  const criteria: MatchCriterionScore[] = result.chi_tiet.map((row) => ({
    key: row.truong,
    label: row.label,
    score: row.S / 100,
    weight: row.trong_so / 100,
    note: `S=${row.S.toFixed(0)} · K=${row.K.toFixed(3)} · ${row.diem.toFixed(2)} điểm`,
  }));
  const weak =
    result.khoang_thieu.length > 0
      ? ` Khoảng thiếu: ${result.khoang_thieu.map((k) => SALES_MATCH_FIELD_LABEL[k]).join(', ')}.`
      : '';
  const company = result.cong_ty_tot_nhat
    ? ` Nền: ${result.cong_ty_tot_nhat.ten}.`
    : '';
  return {
    score: result.diem_phu_hop ?? 0,
    matchedSkills: [],
    missingSkills: [],
    reason: `Độ phù hợp ${result.diem_phu_hop}% (Sales B2B).${company}${weak}`,
    criteria,
    salesMatch: result,
  };
}

export function shouldUseSalesMatchEngine(job: {
  jobTrack?: string | null;
  jobLevel?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
}): boolean {
  const level = job.jobLevel?.trim().toLowerCase() ?? '';
  if (level.startsWith('technical.')) return false;
  const track = job.jobTrack?.trim().toLowerCase();
  if (track === 'technical') return false;
  if (level.startsWith('sales.') || track === 'sales') return true;
  return job.salesCriteria != null;
}

export function jobSalesCriteriaToMatchJd(
  job: {
    title?: string | null;
    location?: string | null;
    experienceBand?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    industry?: string | null;
  },
  sales: JobSalesCriteria | null,
): SalesMatchJdInput {
  const industries = sales?.industries?.length
    ? sales.industries
    : job.industry
      ? [job.industry]
      : [];
  return {
    title: job.title ?? null,
    industries,
    location: job.location ?? null,
    experienceBand: job.experienceBand ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    productsSold: sales?.productsSold ?? [],
    customerSegments: sales?.customerSegments ?? [],
    dealTypes: sales?.dealTypes ?? [],
    sellingStages: sales?.sellingStages ?? [],
    marketsCovered: sales?.marketsCovered ?? [],
    educationLevel: sales?.educationLevel ?? null,
    educationMajor: sales?.educationMajor ?? null,
    languages: sales?.languages ?? [],
    driverLicenses: (sales?.driverLicenses ?? []).filter((l) => l !== 'Chưa có'),
    travelAbility: sales?.travelAbility ?? null,
    hardFilters: sales?.hardFilters ?? [],
    industryHardMinS: sales?.industryHardMinS,
  };
}
