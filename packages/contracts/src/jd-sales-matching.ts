/**
 * Ma trận 22 trường JD Matching Sales B2B (PDF 05.9.2026).
 * Dùng cho tạo / sửa tin tuyển dụng Kinh doanh: AI trích xuất, HR xác nhận.
 *
 * Trọng số chỉ dùng backend matching (chưa chấm điểm trên UI).
 * Không có field cấp bậc trên JD — suy luận thầm từ vị trí nếu cần lọc.
 */

import {
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_OPTIONS,
  DESIRED_POSITIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SALES_INDUSTRY_OPTIONS,
  SELLING_STAGES,
  TravelAbility,
  normalizeCustomerSegment,
  normalizeDealTypeValue,
} from './sales-b2b-criteria';
import { INDUSTRY_GROUPS } from './job-taxonomy';
import { EmploymentType, ExperienceBand } from './enums';

export const JD_SALES_TOTAL_FIELDS = 22;

export type JdSalesGroup = 'A' | 'B' | 'C' | 'D';

export const JD_SALES_GROUPS: Record<
  JdSalesGroup,
  { title: string; subtitle: string; stt: string }
> = {
  A: {
    title: 'A. Thông tin tin tuyển dụng (1–8)',
    subtitle: 'AI điền trước — HR xác nhận vị trí, ngành, địa điểm, thu nhập.',
    stt: '1–8',
  },
  B: {
    title: 'B. Tiêu chí matching Sales (9–13)',
    subtitle: 'Chuẩn hóa từ JD — không suy diễn sản phẩm, khách hàng hay thị trường.',
    stt: '9–13',
  },
  C: {
    title: 'C. Yêu cầu job fit (14–18)',
    subtitle: 'Chỉ mở khi JD nêu học vấn, ngoại ngữ, bằng lái hoặc đi công tác.',
    stt: '14–18',
  },
  D: {
    title: 'D. Nội dung JD (19–22)',
    subtitle: 'Giữ nguyên nội dung file hoặc AI biên tập — HR duyệt trước khi đăng.',
    stt: '19–22',
  },
};

export type JdSalesFieldKey =
  | 'title'
  | 'industries'
  | 'employmentType'
  | 'location'
  | 'experienceBand'
  | 'salary'
  | 'headcount'
  | 'deadline'
  | 'productsSold'
  | 'customerSegments'
  | 'dealTypes'
  | 'sellingStages'
  | 'marketsCovered'
  | 'educationLevel'
  | 'educationMajor'
  | 'languages'
  | 'driverLicenses'
  | 'travelAbility'
  | 'description'
  | 'requirements'
  | 'skills'
  | 'benefits';

export const JD_SALES_FIELDS: readonly {
  key: JdSalesFieldKey;
  stt: number;
  group: JdSalesGroup;
  label: string;
  /** Trọng số matching backend — không hiện cho HR. */
  weightPct: number;
}[] = [
  { key: 'title', stt: 1, group: 'A', label: 'Vị trí tuyển dụng', weightPct: 4 },
  { key: 'industries', stt: 2, group: 'A', label: 'Ngành / lĩnh vực', weightPct: 15 },
  { key: 'employmentType', stt: 3, group: 'A', label: 'Hình thức làm việc', weightPct: 0 },
  { key: 'location', stt: 4, group: 'A', label: 'Địa điểm làm việc', weightPct: 2 },
  { key: 'experienceBand', stt: 5, group: 'A', label: 'Kinh nghiệm yêu cầu', weightPct: 5 },
  { key: 'salary', stt: 6, group: 'A', label: 'Mức thu nhập', weightPct: 2 },
  { key: 'headcount', stt: 7, group: 'A', label: 'Số lượng tuyển dụng', weightPct: 0 },
  { key: 'deadline', stt: 8, group: 'A', label: 'Hạn nộp hồ sơ', weightPct: 0 },
  { key: 'productsSold', stt: 9, group: 'B', label: 'Sản phẩm / thiết bị', weightPct: 20 },
  { key: 'customerSegments', stt: 10, group: 'B', label: 'Nhóm khách hàng', weightPct: 18 },
  { key: 'dealTypes', stt: 11, group: 'B', label: 'Loại hình kinh doanh', weightPct: 7 },
  { key: 'sellingStages', stt: 12, group: 'B', label: 'Phạm vi công việc bán hàng', weightPct: 13 },
  { key: 'marketsCovered', stt: 13, group: 'B', label: 'Khu vực / thị trường phụ trách', weightPct: 7 },
  { key: 'educationLevel', stt: 14, group: 'C', label: 'Trình độ học vấn', weightPct: 1 },
  { key: 'educationMajor', stt: 15, group: 'C', label: 'Chuyên ngành', weightPct: 1 },
  { key: 'languages', stt: 16, group: 'C', label: 'Ngoại ngữ', weightPct: 2 },
  { key: 'driverLicenses', stt: 17, group: 'C', label: 'Giấy phép lái xe', weightPct: 1 },
  { key: 'travelAbility', stt: 18, group: 'C', label: 'Khả năng đi công tác', weightPct: 2 },
  { key: 'description', stt: 19, group: 'D', label: 'Mô tả công việc', weightPct: 0 },
  { key: 'requirements', stt: 20, group: 'D', label: 'Yêu cầu công việc', weightPct: 0 },
  { key: 'skills', stt: 21, group: 'D', label: 'Kỹ năng', weightPct: 0 },
  { key: 'benefits', stt: 22, group: 'D', label: 'Quyền lợi', weightPct: 0 },
];

const JD_SALES_FIELD_KEY_SET = new Set<string>(JD_SALES_FIELDS.map((f) => f.key));

/** B1 — chỉ nhận key 22 trường JD; bỏ việc làm / hạn nộp / mô tả (trọng số 0). */
const HARD_FILTER_ALLOWED = new Set<JdSalesFieldKey>([
  'title',
  'industries',
  'location',
  'experienceBand',
  'salary',
  'productsSold',
  'customerSegments',
  'dealTypes',
  'sellingStages',
  'marketsCovered',
  'educationLevel',
  'educationMajor',
  'languages',
  'driverLicenses',
  'travelAbility',
]);

/** Catalog gợi ý vị trí JD Sales (không bắt buộc chọn trong list). */
export const JD_SALES_TITLE_OPTIONS = DESIRED_POSITIONS;

export const JD_SALES_INDUSTRY_OPTIONS = [...SALES_INDUSTRY_OPTIONS, 'Khác'] as const;

/** Tiêu chí Sales lưu JSON trên tin (nhóm B + C + ngành đa chọn). */
export interface JobSalesCriteria {
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  /** Mã DealType (equipment, consumables, …). */
  dealTypes: string[];
  sellingStages: string[];
  marketsCovered: string[];
  educationLevel: string | null;
  educationMajor: string | null;
  languages: string[];
  driverLicenses: string[];
  travelAbility: string | null;
  /**
   * B1 — trường HR đánh dấu bắt buộc (lọc cứng, không sinh điểm).
   * Dùng JdSalesFieldKey (`productsSold`, `languages`, …). Trống = không lọc.
   */
  hardFilters?: JdSalesFieldKey[];
  /**
   * Câu C v1.1 — ngưỡng lọc cứng ngành. Chỉ dùng khi `hardFilters` có `industries`.
   * 85 = chấp nhận cùng cụm khác nhóm (mặc định). 100 = chỉ đúng ngành.
   */
  industryHardMinS?: 85 | 100;
}

export const EMPTY_JOB_SALES_CRITERIA: JobSalesCriteria = {
  industries: [],
  productsSold: [],
  customerSegments: [],
  dealTypes: [],
  sellingStages: [],
  marketsCovered: [],
  educationLevel: null,
  educationMajor: null,
  languages: [],
  driverLicenses: [],
  travelAbility: null,
  hardFilters: [],
};

export function emptyJobSalesCriteria(): JobSalesCriteria {
  return {
    industries: [],
    productsSold: [],
    customerSegments: [],
    dealTypes: [],
    sellingStages: [],
    marketsCovered: [],
    educationLevel: null,
    educationMajor: null,
    languages: [],
    driverLicenses: [],
    travelAbility: null,
    hardFilters: [],
  };
}

function uniqStrings(values: unknown, max = 40): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const raw of values) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    if (!out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const INDUSTRY_SET = new Set<string>([...INDUSTRY_GROUPS, ...SALES_INDUSTRY_OPTIONS, 'Khác']);
const PRODUCT_SET = new Set<string>(PRODUCTS_SOLD);
const SEGMENT_SET = new Set<string>(CUSTOMER_SEGMENTS);
const STAGE_SET = new Set<string>(SELLING_STAGES);
const MARKET_SET = new Set<string>(MARKET_REGIONS);
const EDU_SET = new Set<string>(EDUCATION_LEVELS);
const LANG_SET = new Set<string>(LANGUAGE_OPTIONS);
const LICENSE_SET = new Set<string>(DRIVER_LICENSE_TYPES);
const TRAVEL_SET = new Set<string>(Object.values(TravelAbility));
const DEAL_SET = new Set<string>(DEAL_TYPE_OPTIONS);

function pickCatalog(values: unknown, catalog: Set<string>): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values)) {
    if (catalog.has(raw)) {
      if (!out.includes(raw)) out.push(raw);
      continue;
    }
    const lower = raw.toLowerCase();
    const found = [...catalog].find((c) => c.toLowerCase() === lower);
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

function pickIndustries(values: unknown): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values)) {
    if (INDUSTRY_SET.has(raw)) {
      if (!out.includes(raw)) out.push(raw);
      continue;
    }
    const lower = raw.toLowerCase();
    const found = [...INDUSTRY_SET].find((c) => c.toLowerCase() === lower);
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

function pickProducts(values: unknown): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values, 24)) {
    if (PRODUCT_SET.has(raw)) {
      if (!out.includes(raw)) out.push(raw);
      continue;
    }
    const lower = raw.toLowerCase();
    const found = [...PRODUCT_SET].find((c) => c.toLowerCase() === lower);
    if (found && !out.includes(found)) {
      out.push(found);
      continue;
    }
    // HR / AI có thể nhập tên thiết bị cụ thể ngoài catalog.
    if (raw.length >= 3 && !out.some((x) => x.toLowerCase() === lower)) out.push(raw);
  }
  return out;
}

function pickSegments(values: unknown): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values)) {
    const n = normalizeCustomerSegment(raw);
    if (n && SEGMENT_SET.has(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

function pickDealTypes(values: unknown): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values)) {
    const n = normalizeDealTypeValue(raw);
    if (n && DEAL_SET.has(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

function pickEducation(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (EDU_SET.has(s)) return s;
  const found = [...EDU_SET].find((c) => c.toLowerCase() === s.toLowerCase());
  return found ?? null;
}

function pickTravel(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (TRAVEL_SET.has(s)) return s;
  const lower = s.toLowerCase();
  if (/không/.test(lower)) return TravelAbility.None;
  if (/dài ngày|over_50/.test(lower)) return TravelAbility.Over50;
  if (/thường xuyên|25_50/.test(lower)) return TravelAbility.From25To50;
  if (/khi cần|up_to_25|công tác/.test(lower)) return TravelAbility.UpTo25;
  return null;
}

export function normalizeJobSalesCriteria(raw: unknown): JobSalesCriteria {
  const r = (raw ?? {}) as Record<string, unknown>;
  const educationMajor = String(r.educationMajor ?? '').trim();
  return {
    industries: pickIndustries(r.industries),
    productsSold: pickProducts(r.productsSold),
    customerSegments: pickSegments(r.customerSegments),
    dealTypes: pickDealTypes(r.dealTypes),
    sellingStages: pickCatalog(r.sellingStages, STAGE_SET),
    marketsCovered: pickCatalog(r.marketsCovered, MARKET_SET),
    educationLevel: pickEducation(r.educationLevel),
    educationMajor: educationMajor || null,
    languages: pickCatalog(r.languages, LANG_SET),
    driverLicenses: pickCatalog(r.driverLicenses, LICENSE_SET),
    travelAbility: pickTravel(r.travelAbility),
    hardFilters: pickHardFilters(r.hardFilters),
    industryHardMinS: pickIndustryHardMinS(r.industryHardMinS),
  };
}

function pickIndustryHardMinS(raw: unknown): 85 | 100 | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (n === 100) return 100;
  if (n === 85) return 85;
  return undefined;
}

function pickHardFilters(values: unknown): JdSalesFieldKey[] {
  const out: JdSalesFieldKey[] = [];
  for (const raw of uniqStrings(values)) {
    if (!JD_SALES_FIELD_KEY_SET.has(raw)) continue;
    const key = raw as JdSalesFieldKey;
    if (HARD_FILTER_ALLOWED.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function hasJobFitCriteria(c: JobSalesCriteria): boolean {
  return Boolean(
    c.educationLevel ||
      c.educationMajor ||
      c.languages.length ||
      c.driverLicenses.length ||
      c.travelAbility,
  );
}

/** Kết quả AI trích 22 trường từ file / văn bản JD. */
export interface ParseJobDescriptionRequest {
  text: string;
}

export interface ParsedSalesJobDraft {
  title: string;
  industries: string[];
  employmentType: EmploymentType | null;
  location: string;
  experienceBand: ExperienceBand | null;
  salaryMin: number | null;
  salaryMax: number | null;
  headcount: number | null;
  deadline: string | null;
  productsSold: string[];
  customerSegments: string[];
  dealTypes: string[];
  sellingStages: string[];
  marketsCovered: string[];
  educationLevel: string | null;
  educationMajor: string | null;
  languages: string[];
  driverLicenses: string[];
  travelAbility: string | null;
  description: string;
  requirements: string;
  skills: string[];
  benefits: string;
  /** Trường AI đã điền nhưng chưa chắc — HR nên xác nhận. */
  uncertainKeys: JdSalesFieldKey[];
  notes?: string | null;
}

export function emptyParsedSalesJobDraft(): ParsedSalesJobDraft {
  return {
    title: '',
    industries: [],
    employmentType: null,
    location: '',
    experienceBand: null,
    salaryMin: null,
    salaryMax: null,
    headcount: null,
    deadline: null,
    productsSold: [],
    customerSegments: [],
    dealTypes: [],
    sellingStages: [],
    marketsCovered: [],
    educationLevel: null,
    educationMajor: null,
    languages: [],
    driverLicenses: [],
    travelAbility: null,
    description: '',
    requirements: '',
    skills: [],
    benefits: '',
    uncertainKeys: [],
    notes: null,
  };
}

export function parsedDraftToSalesCriteria(draft: ParsedSalesJobDraft): JobSalesCriteria {
  return normalizeJobSalesCriteria({
    industries: draft.industries,
    productsSold: draft.productsSold,
    customerSegments: draft.customerSegments,
    dealTypes: draft.dealTypes,
    sellingStages: draft.sellingStages,
    marketsCovered: draft.marketsCovered,
    educationLevel: draft.educationLevel,
    educationMajor: draft.educationMajor,
    languages: draft.languages,
    driverLicenses: draft.driverLicenses,
    travelAbility: draft.travelAbility,
  });
}
