/**
 * Ma trận 23 trường JD Matching Kỹ thuật (PDF 05.09.2026).
 * Dùng cho tạo / sửa tin tuyển dụng Kỹ thuật: AI trích xuất, HR xác nhận.
 *
 * Trọng số chỉ dùng backend matching (chưa chấm điểm trên UI).
 * Không có field cấp bậc trên JD — suy luận thầm từ vị trí / kinh nghiệm / tự chủ.
 */

import {
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  LANGUAGE_OPTIONS,
  TravelAbility,
} from './sales-b2b-criteria';
import {
  DOCUMENT_LITERACY_OPTIONS,
  EQUIPMENT_SYSTEM_OPTIONS,
  SHIFT_FLEXIBILITY_OPTIONS,
  TECHNICAL_AUTONOMY_LEVELS,
  TECHNICAL_DESIRED_POSITIONS,
  TECHNICAL_TOOLS,
  TECHNICAL_WORK_TYPES,
  WORK_ENVIRONMENT_OPTIONS,
} from './technical-criteria';
import { INDUSTRY_GROUPS } from './job-taxonomy';
import { ExperienceBand } from './enums';

export const JD_TECHNICAL_TOTAL_FIELDS = 23;

export type JdTechnicalGroup = 'A' | 'B' | 'C' | 'D';

export const JD_TECHNICAL_GROUPS: Record<
  JdTechnicalGroup,
  { title: string; subtitle: string; stt: string }
> = {
  A: {
    title: 'A. Thông tin tin tuyển dụng (1–7)',
    subtitle: 'AI điền trước — HR xác nhận vị trí, lĩnh vực, địa điểm, thu nhập.',
    stt: '1–7',
  },
  B: {
    title: 'B. Tiêu chí matching kỹ thuật (8–11)',
    subtitle: 'Chuẩn hóa từ JD — không suy diễn thiết bị, môi trường hay công việc kỹ thuật.',
    stt: '8–11',
  },
  C: {
    title: 'C. Yêu cầu job fit (12–20)',
    subtitle: 'Chỉ mở khi JD nêu học vấn, chứng chỉ, bằng lái, công tác, ngoài giờ hoặc tài liệu kỹ thuật.',
    stt: '12–20',
  },
  D: {
    title: 'D. Nội dung JD (21–23)',
    subtitle: 'Giữ nguyên nội dung file hoặc AI biên tập — HR duyệt trước khi đăng.',
    stt: '21–23',
  },
};

export type JdTechnicalFieldKey =
  | 'title'
  | 'industries'
  | 'location'
  | 'experienceBand'
  | 'salary'
  | 'headcount'
  | 'deadline'
  | 'equipmentSystems'
  | 'workEnvironments'
  | 'technicalWorkTypes'
  | 'autonomyLevel'
  | 'educationLevel'
  | 'educationMajor'
  | 'languages'
  | 'certificates'
  | 'driverLicenses'
  | 'travelAbility'
  | 'shiftFlexibility'
  | 'technicalTools'
  | 'documentLiteracy'
  | 'description'
  | 'requirements'
  | 'benefits';

export const JD_TECHNICAL_FIELDS: readonly {
  key: JdTechnicalFieldKey;
  stt: number;
  group: JdTechnicalGroup;
  label: string;
  /** Trọng số matching backend — không hiện cho HR. */
  weightPct: number;
}[] = [
  { key: 'title', stt: 1, group: 'A', label: 'Vị trí tuyển dụng', weightPct: 4 },
  { key: 'industries', stt: 2, group: 'A', label: 'Lĩnh vực / ngành kỹ thuật', weightPct: 15 },
  { key: 'location', stt: 3, group: 'A', label: 'Địa điểm làm việc', weightPct: 2 },
  { key: 'experienceBand', stt: 4, group: 'A', label: 'Kinh nghiệm yêu cầu', weightPct: 6 },
  { key: 'salary', stt: 5, group: 'A', label: 'Mức thu nhập', weightPct: 2 },
  { key: 'headcount', stt: 6, group: 'A', label: 'Số lượng tuyển dụng', weightPct: 0 },
  { key: 'deadline', stt: 7, group: 'A', label: 'Hạn nộp hồ sơ', weightPct: 0 },
  { key: 'equipmentSystems', stt: 8, group: 'B', label: 'Thiết bị / hệ thống', weightPct: 21 },
  { key: 'workEnvironments', stt: 9, group: 'B', label: 'Môi trường làm việc', weightPct: 4 },
  { key: 'technicalWorkTypes', stt: 10, group: 'B', label: 'Công việc kỹ thuật', weightPct: 17 },
  { key: 'autonomyLevel', stt: 11, group: 'B', label: 'Mức độ tự chủ', weightPct: 10 },
  { key: 'educationLevel', stt: 12, group: 'C', label: 'Trình độ học vấn', weightPct: 1 },
  { key: 'educationMajor', stt: 13, group: 'C', label: 'Chuyên ngành', weightPct: 3 },
  { key: 'languages', stt: 14, group: 'C', label: 'Ngoại ngữ', weightPct: 1 },
  { key: 'certificates', stt: 15, group: 'C', label: 'Chứng chỉ', weightPct: 2 },
  { key: 'driverLicenses', stt: 16, group: 'C', label: 'Giấy phép lái xe', weightPct: 3 },
  { key: 'travelAbility', stt: 17, group: 'C', label: 'Khả năng đi công tác', weightPct: 3 },
  { key: 'shiftFlexibility', stt: 18, group: 'C', label: 'Khả năng làm ngoài giờ / xử lý sự cố', weightPct: 2 },
  { key: 'technicalTools', stt: 19, group: 'C', label: 'Công cụ / phần mềm', weightPct: 1 },
  { key: 'documentLiteracy', stt: 20, group: 'C', label: 'Bản vẽ / tài liệu kỹ thuật', weightPct: 3 },
  { key: 'description', stt: 21, group: 'D', label: 'Mô tả công việc', weightPct: 0 },
  { key: 'requirements', stt: 22, group: 'D', label: 'Yêu cầu công việc', weightPct: 0 },
  { key: 'benefits', stt: 23, group: 'D', label: 'Quyền lợi / phúc lợi', weightPct: 0 },
];

export const JD_TECHNICAL_TITLE_OPTIONS = TECHNICAL_DESIRED_POSITIONS;

export const JD_TECHNICAL_INDUSTRY_OPTIONS = [...INDUSTRY_GROUPS] as const;

/** Gợi ý chứng chỉ nghề — HR / AI có thể thêm tên cụ thể nếu JD nêu. */
export const JD_TECHNICAL_CERTIFICATE_OPTIONS = [
  'An toàn điện',
  'An toàn lao động',
  'PCCC',
  'ISO 9001',
  'Vận hành thiết bị áp lực',
  'Cẩu / nâng hạ',
  'NDE / NDT',
] as const;

export type JobTechnicalShiftFlexibility = (typeof SHIFT_FLEXIBILITY_OPTIONS)[number]['value'];

/** Tiêu chí kỹ thuật lưu JSON trên tin (nhóm B + C + ngành đa chọn). */
export interface JobTechnicalCriteria {
  industries: string[];
  equipmentSystems: string[];
  workEnvironments: string[];
  technicalWorkTypes: string[];
  /** Mức tự chủ tối thiểu 1–5; null = JD không yêu cầu. */
  autonomyLevel: number | null;
  educationLevel: string | null;
  educationMajor: string | null;
  languages: string[];
  certificates: string[];
  driverLicenses: string[];
  travelAbility: string | null;
  shiftFlexibility: string | null;
  technicalTools: string[];
  documentLiteracy: string[];
  hardFilters?: JdTechnicalFieldKey[];
  /** Ngưỡng lọc cứng ngành. Chỉ dùng khi `hardFilters` có `industries`. */
  industryHardMinS?: 85 | 100;
}

export const EMPTY_JOB_TECHNICAL_CRITERIA: JobTechnicalCriteria = {
  industries: [],
  equipmentSystems: [],
  workEnvironments: [],
  technicalWorkTypes: [],
  autonomyLevel: null,
  educationLevel: null,
  educationMajor: null,
  languages: [],
  certificates: [],
  driverLicenses: [],
  travelAbility: null,
  shiftFlexibility: null,
  technicalTools: [],
  documentLiteracy: [],
};

export function emptyJobTechnicalCriteria(): JobTechnicalCriteria {
  return { ...EMPTY_JOB_TECHNICAL_CRITERIA, industries: [], equipmentSystems: [], workEnvironments: [], technicalWorkTypes: [], languages: [], certificates: [], driverLicenses: [], technicalTools: [], documentLiteracy: [] };
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

const INDUSTRY_SET = new Set<string>([...INDUSTRY_GROUPS, 'Khác']);
const EQUIPMENT_SET = new Set<string>(EQUIPMENT_SYSTEM_OPTIONS);
const ENV_SET = new Set<string>(WORK_ENVIRONMENT_OPTIONS);
const WORK_SET = new Set<string>(TECHNICAL_WORK_TYPES);
const EDU_SET = new Set<string>(EDUCATION_LEVELS);
const LANG_SET = new Set<string>(LANGUAGE_OPTIONS);
const LICENSE_SET = new Set<string>(DRIVER_LICENSE_TYPES);
const TRAVEL_SET = new Set<string>(Object.values(TravelAbility));
const SHIFT_SET = new Set<string>(SHIFT_FLEXIBILITY_OPTIONS.map((o) => o.value));
const TOOL_SET = new Set<string>(TECHNICAL_TOOLS);
const DOC_SET = new Set<string>(DOCUMENT_LITERACY_OPTIONS);
const CERT_SET = new Set<string>(JD_TECHNICAL_CERTIFICATE_OPTIONS);

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

function pickCatalogOrCustom(values: unknown, catalog: Set<string>, max = 24): string[] {
  const out: string[] = [];
  for (const raw of uniqStrings(values, max)) {
    if (catalog.has(raw)) {
      if (!out.includes(raw)) out.push(raw);
      continue;
    }
    const lower = raw.toLowerCase();
    const found = [...catalog].find((c) => c.toLowerCase() === lower);
    if (found && !out.includes(found)) {
      out.push(found);
      continue;
    }
    if (raw.length >= 3 && !out.some((x) => x.toLowerCase() === lower)) out.push(raw);
  }
  return out;
}

function pickIndustries(values: unknown): string[] {
  return pickCatalog(values, INDUSTRY_SET);
}

function pickEducation(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (EDU_SET.has(s)) return s;
  return [...EDU_SET].find((c) => c.toLowerCase() === s.toLowerCase()) ?? null;
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

function pickShift(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (SHIFT_SET.has(s)) return s;
  const lower = s.toLowerCase();
  if (/không thể|không sẵn|no\b/.test(lower)) return 'no';
  if (/giới hạn|limited|hạn chế/.test(lower)) return 'limited';
  if (/sẵn sàng|có[,.]|yes|tăng ca|ngoài giờ|trực ca/.test(lower)) return 'yes';
  return null;
}

function pickAutonomy(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export function normalizeJobTechnicalCriteria(raw: unknown): JobTechnicalCriteria {
  const r = (raw ?? {}) as Record<string, unknown>;
  const educationMajor = String(r.educationMajor ?? '').trim();
  return {
    industries: pickIndustries(r.industries),
    equipmentSystems: pickCatalogOrCustom(
      r.equipmentSystems ?? r.productsSold,
      EQUIPMENT_SET,
    ),
    workEnvironments: pickCatalog(r.workEnvironments ?? r.customerSegments, ENV_SET),
    technicalWorkTypes: pickCatalog(r.technicalWorkTypes ?? r.sellingStages, WORK_SET),
    autonomyLevel: pickAutonomy(r.autonomyLevel ?? r.technicalAutonomyLevel),
    educationLevel: pickEducation(r.educationLevel),
    educationMajor: educationMajor || null,
    languages: pickCatalog(r.languages, LANG_SET),
    certificates: pickCatalogOrCustom(r.certificates, CERT_SET, 20),
    driverLicenses: pickCatalog(r.driverLicenses, LICENSE_SET),
    travelAbility: pickTravel(r.travelAbility),
    shiftFlexibility: pickShift(r.shiftFlexibility),
    technicalTools: pickCatalogOrCustom(r.technicalTools, TOOL_SET),
    documentLiteracy: pickCatalogOrCustom(r.documentLiteracy, DOC_SET),
    hardFilters: pickTechHardFilters(r.hardFilters),
    industryHardMinS: pickTechIndustryHardMinS(r.industryHardMinS),
  };
}

function pickTechIndustryHardMinS(raw: unknown): 85 | 100 | undefined {
  if (raw === 100 || raw === '100') return 100;
  if (raw === 85 || raw === '85') return 85;
  return undefined;
}

const TECH_HARD_KEYS = new Set<JdTechnicalFieldKey>([
  'title',
  'industries',
  'location',
  'experienceBand',
  'salary',
  'equipmentSystems',
  'workEnvironments',
  'technicalWorkTypes',
  'autonomyLevel',
  'educationLevel',
  'educationMajor',
  'languages',
  'certificates',
  'driverLicenses',
  'travelAbility',
  'shiftFlexibility',
  'technicalTools',
  'documentLiteracy',
]);

function pickTechHardFilters(values: unknown): JdTechnicalFieldKey[] {
  if (!Array.isArray(values)) return [];
  const out: JdTechnicalFieldKey[] = [];
  for (const raw of values) {
    const k = String(raw ?? '').trim() as JdTechnicalFieldKey;
    if (TECH_HARD_KEYS.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

export function hasTechnicalJobFitCriteria(c: JobTechnicalCriteria): boolean {
  return Boolean(
    c.educationLevel ||
      c.educationMajor ||
      c.languages.length ||
      c.certificates.length ||
      c.driverLicenses.length ||
      c.travelAbility ||
      c.shiftFlexibility ||
      c.technicalTools.length ||
      c.documentLiteracy.length,
  );
}

export interface ParsedTechnicalJobDraft {
  title: string;
  industries: string[];
  location: string;
  experienceBand: ExperienceBand | null;
  salaryMin: number | null;
  salaryMax: number | null;
  headcount: number | null;
  deadline: string | null;
  equipmentSystems: string[];
  workEnvironments: string[];
  technicalWorkTypes: string[];
  autonomyLevel: number | null;
  educationLevel: string | null;
  educationMajor: string | null;
  languages: string[];
  certificates: string[];
  driverLicenses: string[];
  travelAbility: string | null;
  shiftFlexibility: string | null;
  technicalTools: string[];
  documentLiteracy: string[];
  description: string;
  requirements: string;
  benefits: string;
  uncertainKeys: JdTechnicalFieldKey[];
  notes?: string | null;
}

export function emptyParsedTechnicalJobDraft(): ParsedTechnicalJobDraft {
  return {
    title: '',
    industries: [],
    location: '',
    experienceBand: null,
    salaryMin: null,
    salaryMax: null,
    headcount: null,
    deadline: null,
    equipmentSystems: [],
    workEnvironments: [],
    technicalWorkTypes: [],
    autonomyLevel: null,
    educationLevel: null,
    educationMajor: null,
    languages: [],
    certificates: [],
    driverLicenses: [],
    travelAbility: null,
    shiftFlexibility: null,
    technicalTools: [],
    documentLiteracy: [],
    description: '',
    requirements: '',
    benefits: '',
    uncertainKeys: [],
    notes: null,
  };
}

export function parsedDraftToTechnicalCriteria(draft: ParsedTechnicalJobDraft): JobTechnicalCriteria {
  return normalizeJobTechnicalCriteria({
    industries: draft.industries,
    equipmentSystems: draft.equipmentSystems,
    workEnvironments: draft.workEnvironments,
    technicalWorkTypes: draft.technicalWorkTypes,
    autonomyLevel: draft.autonomyLevel,
    educationLevel: draft.educationLevel,
    educationMajor: draft.educationMajor,
    languages: draft.languages,
    certificates: draft.certificates,
    driverLicenses: draft.driverLicenses,
    travelAbility: draft.travelAbility,
    shiftFlexibility: draft.shiftFlexibility,
    technicalTools: draft.technicalTools,
    documentLiteracy: draft.documentLiteracy,
  });
}

export const JD_TECHNICAL_AUTONOMY_OPTIONS = TECHNICAL_AUTONOMY_LEVELS;
export const JD_TECHNICAL_SHIFT_OPTIONS = SHIFT_FLEXIBILITY_OPTIONS;
