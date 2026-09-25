/**
 * Engine Matching JD ↔ hồ sơ — nhánh Kỹ thuật.
 * Nguồn: Bảng quy tắc lập trình v1.0 (21.09.2026) — 52 quy tắc A–I.
 * Bảng tra cứu: du_lieu_matching_ky_thuat.json (1.0 / 2026-09-21).
 * Mã trường bắt buộc tiền tố tech. (P5) — tech.jd09 ≠ sales jd09.
 * Không gọi LLM lúc chấm (I5).
 */

import { type LanguageSkill } from './sales-b2b-criteria';
import {
  SHIFT_FLEXIBILITY_OPTIONS,
  TECHNICAL_DESIRED_POSITIONS,
} from './technical-criteria';
import type { JdTechnicalFieldKey, JobTechnicalCriteria } from './jd-technical-matching';
import type {
  MatchCriterionScore,
  MatchExplanation,
  SalesMatchCompanySummary,
  TechnicalMatchFieldCode,
  TechnicalMatchFieldDetail,
  TechnicalMatchResult,
} from './matching.dto';
import {
  companyYearsG2,
  durationFactorG2,
  educationSimilarityS,
  experienceSimilarityS,
  industryLeakageK_D1,
  industrySimilarityC5,
  languageSimilarityS,
  locationSimilarityS,
  majorSimilarityS,
  multiSelectCoverageE1,
  recencyFactorG3,
  renormalizeBlockF2,
  salarySimilarityS,
  travelSimilarityS,
} from './sales-matching-engine';
import {
  TECH_AUTONOMY_SCORES,
  TECH_DOC_CODES,
  TECH_DOC_NAMES,
  TECH_DOC_SIMILARITY_MATRIX,
  TECH_ENV_CODES,
  TECH_ENV_NAMES,
  TECH_ENV_SIMILARITY_MATRIX,
  TECH_EQUIPMENT_CODES,
  TECH_EQUIPMENT_NAMES,
  TECH_EQUIPMENT_SIMILARITY_MATRIX,
  TECH_MATCH_CONSTANTS,
  TECH_TITLE_RANKS,
  TECH_TITLE_SCORES,
  TECH_TOOL_CATALOG,
  TECH_WORK_CODES,
  TECH_WORK_NAMES,
  TECH_WORK_SIMILARITY_MATRIX,
} from './technical-matching-tables';

export {
  TECH_MATCH_CONSTANTS,
  TECH_MATCH_DATA_VERSION,
  TECH_EQUIPMENT_CODES,
  TECH_EQUIPMENT_NAMES,
  TECH_WORK_CODES,
  TECH_WORK_NAMES,
} from './technical-matching-tables';

export const TECH_MATCH_FIELD_WEIGHTS: Record<TechnicalMatchFieldCode, number> = {
  'tech.jd01a': 1,
  'tech.jd01b': 3,
  'tech.jd02': 15,
  'tech.jd03': 2,
  'tech.jd04': 6,
  'tech.jd05': 2,
  'tech.jd08': 21,
  'tech.jd09': 4,
  'tech.jd10': 17,
  'tech.jd11': 10,
  'tech.jd12': 1,
  'tech.jd13': 3,
  'tech.jd14': 1,
  'tech.jd15': 2,
  'tech.jd16': 3,
  'tech.jd17': 3,
  'tech.jd18': 2,
  'tech.jd19': 1,
  'tech.jd20': 3,
};

export const TECH_MATCH_COMPANY_FIELDS: readonly TechnicalMatchFieldCode[] = [
  'tech.jd01b',
  'tech.jd02',
  'tech.jd08',
  'tech.jd09',
  'tech.jd10',
  'tech.jd11',
];

export const TECH_MATCH_PROFILE_FIELDS: readonly TechnicalMatchFieldCode[] = [
  'tech.jd01a',
  'tech.jd03',
  'tech.jd04',
  'tech.jd05',
  'tech.jd12',
  'tech.jd13',
  'tech.jd14',
  'tech.jd15',
  'tech.jd16',
  'tech.jd17',
  'tech.jd18',
  'tech.jd19',
  'tech.jd20',
];

export const TECH_MATCH_FIELD_LABEL: Record<TechnicalMatchFieldCode, string> = {
  'tech.jd01a': 'Vị trí ứng tuyển',
  'tech.jd01b': 'Vị trí đã làm',
  'tech.jd02': 'Ngành / lĩnh vực kỹ thuật',
  'tech.jd03': 'Địa điểm làm việc',
  'tech.jd04': 'Kinh nghiệm yêu cầu',
  'tech.jd05': 'Mức thu nhập',
  'tech.jd08': 'Thiết bị / hệ thống',
  'tech.jd09': 'Môi trường làm việc',
  'tech.jd10': 'Công việc kỹ thuật',
  'tech.jd11': 'Mức độ tự chủ',
  'tech.jd12': 'Trình độ học vấn',
  'tech.jd13': 'Chuyên ngành',
  'tech.jd14': 'Ngoại ngữ',
  'tech.jd15': 'Chứng chỉ',
  'tech.jd16': 'Giấy phép lái xe',
  'tech.jd17': 'Khả năng đi công tác',
  'tech.jd18': 'Khả năng làm ngoài giờ / xử lý sự cố',
  'tech.jd19': 'Công cụ / phần mềm',
  'tech.jd20': 'Bản vẽ / tài liệu kỹ thuật',
};

export const TECH_MATCH_FIELD_ALPHA: Record<TechnicalMatchFieldCode, number> = {
  'tech.jd01a': 0,
  'tech.jd01b': 0.3,
  'tech.jd02': 0,
  'tech.jd03': 0,
  'tech.jd04': 0,
  'tech.jd05': 0,
  'tech.jd08': 0.7,
  'tech.jd09': 0.2,
  'tech.jd10': 0.3,
  'tech.jd11': 0.4,
  'tech.jd12': 0,
  'tech.jd13': 0,
  'tech.jd14': 0,
  'tech.jd15': 0,
  'tech.jd16': 0,
  'tech.jd17': 0,
  'tech.jd18': 0,
  'tech.jd19': 0,
  'tech.jd20': 0,
};

export function assertTechnicalMatchWeights(): void {
  const company = TECH_MATCH_COMPANY_FIELDS.reduce((s, k) => s + TECH_MATCH_FIELD_WEIGHTS[k], 0);
  const profile = TECH_MATCH_PROFILE_FIELDS.reduce((s, k) => s + TECH_MATCH_FIELD_WEIGHTS[k], 0);
  const total = Object.values(TECH_MATCH_FIELD_WEIGHTS).reduce((s, w) => s + w, 0);
  if (
    company !== TECH_MATCH_CONSTANTS.KHOI_CONG_TY ||
    profile !== TECH_MATCH_CONSTANTS.KHOI_CHUNG ||
    total !== 100
  ) {
    throw new Error(
      `A5: trọng số matching Kỹ thuật phải 70+30=100 (nhận ${company}+${profile}=${total})`,
    );
  }
}

assertTechnicalMatchWeights();

export interface TechnicalMatchJdInput {
  title?: string | null;
  industries: string[];
  location?: string | null;
  experienceBand?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  equipmentSystems: string[];
  workEnvironments: string[];
  technicalWorkTypes: string[];
  autonomyLevel?: number | null;
  educationLevel?: string | null;
  educationMajor?: string | null;
  languages: string[];
  certificates: string[];
  driverLicenses: string[];
  travelAbility?: string | null;
  shiftFlexibility?: string | null;
  technicalTools: string[];
  documentLiteracy: string[];
  hardFilters?: JdTechnicalFieldKey[];
  industryHardMinS?: 85 | 100;
}

export interface TechnicalMatchCompanyInput {
  ten: string;
  jobTitle?: string | null;
  industries: string[];
  equipmentSystems: string[];
  workEnvironments: string[];
  technicalWorkTypes: string[];
  startYear?: number | null;
  endYear?: number | null;
  isCurrent?: boolean;
}

export interface TechnicalMatchProfileInput {
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
  certificates: string[];
  driverLicenses: string[];
  travelAbility?: string | null;
  shiftFlexibility?: string | null;
  technicalTools: string[];
  documentLiteracy: string[];
  autonomyLevel?: number | null;
  industriesExperienced?: string[];
  equipmentSystems?: string[];
  workEnvironments?: string[];
  technicalWorkTypes?: string[];
}

export interface ScoreTechnicalMatchInput {
  jd: TechnicalMatchJdInput;
  profile: TechnicalMatchProfileInput;
  companies: TechnicalMatchCompanyInput[];
  asOfYear?: number;
}

const JD_KEY_TO_FIELD: Partial<Record<JdTechnicalFieldKey, TechnicalMatchFieldCode>> = {
  title: 'tech.jd01a',
  industries: 'tech.jd02',
  location: 'tech.jd03',
  experienceBand: 'tech.jd04',
  salary: 'tech.jd05',
  equipmentSystems: 'tech.jd08',
  workEnvironments: 'tech.jd09',
  technicalWorkTypes: 'tech.jd10',
  autonomyLevel: 'tech.jd11',
  educationLevel: 'tech.jd12',
  educationMajor: 'tech.jd13',
  languages: 'tech.jd14',
  certificates: 'tech.jd15',
  driverLicenses: 'tech.jd16',
  travelAbility: 'tech.jd17',
  shiftFlexibility: 'tech.jd18',
  technicalTools: 'tech.jd19',
  documentLiteracy: 'tech.jd20',
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function isKhacValue(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim();
  if (!t) return false;
  return /^(khac|khác|other)$/i.test(t);
}

function catalogIndex(
  raw: string,
  codes: readonly string[],
  names: Record<string, string>,
): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = norm(t);
  const byCode = codes.findIndex((c) => c.toLowerCase() === n || c === t.toUpperCase());
  if (byCode >= 0) return byCode;
  const byName = codes.findIndex((c) => norm(names[c] ?? '') === n);
  if (byName >= 0) return byName;
  if (isKhacValue(t)) {
    const khac = codes.findIndex((c) => c === 'KHAC' || norm(names[c] ?? '') === 'khac');
    return khac >= 0 ? khac : null;
  }
  const fuzzy = codes.findIndex((c) => {
    const name = norm(names[c] ?? '');
    return name.includes(n) || n.includes(name);
  });
  return fuzzy >= 0 ? fuzzy : null;
}

export function equipmentPairSimilarity(cv: string, jd: string): number {
  const i = catalogIndex(cv, TECH_EQUIPMENT_CODES, TECH_EQUIPMENT_NAMES);
  const j = catalogIndex(jd, TECH_EQUIPMENT_CODES, TECH_EQUIPMENT_NAMES);
  if (i == null || j == null) {
    if (norm(cv) === norm(jd)) return 100;
    return isKhacValue(cv) || isKhacValue(jd)
      ? isKhacValue(cv) && isKhacValue(jd)
        ? TECH_MATCH_CONSTANTS.KHAC_GAP_KHAC
        : TECH_MATCH_CONSTANTS.MOT_BEN_KHAC
      : 0;
  }
  return TECH_EQUIPMENT_SIMILARITY_MATRIX[i][j];
}

export function workTypePairSimilarity(cv: string, jd: string): number {
  const i = catalogIndex(cv, TECH_WORK_CODES, TECH_WORK_NAMES);
  const j = catalogIndex(jd, TECH_WORK_CODES, TECH_WORK_NAMES);
  if (i == null || j == null) return norm(cv) === norm(jd) ? 100 : 0;
  return TECH_WORK_SIMILARITY_MATRIX[i][j];
}

export function environmentPairSimilarity(cv: string, jd: string): number {
  const i = catalogIndex(cv, TECH_ENV_CODES, TECH_ENV_NAMES);
  const j = catalogIndex(jd, TECH_ENV_CODES, TECH_ENV_NAMES);
  if (i == null || j == null) return norm(cv) === norm(jd) ? 100 : 0;
  return TECH_ENV_SIMILARITY_MATRIX[i][j];
}

export function documentPairSimilarity(cv: string, jd: string): number {
  const i = catalogIndex(cv, TECH_DOC_CODES, TECH_DOC_NAMES);
  const j = catalogIndex(jd, TECH_DOC_CODES, TECH_DOC_NAMES);
  if (i == null || j == null) return norm(cv) === norm(jd) ? 100 : 0;
  return TECH_DOC_SIMILARITY_MATRIX[i][j];
}

export function toolPairSimilarity(cv: string, jd: string): number {
  if (isKhacValue(cv) && isKhacValue(jd)) return TECH_MATCH_CONSTANTS.KHAC_GAP_KHAC;
  if (isKhacValue(cv) || isKhacValue(jd)) return TECH_MATCH_CONSTANTS.MOT_BEN_KHAC;
  const a = norm(cv);
  const b = norm(jd);
  if (a === b) return 100;
  const hitA = TECH_TOOL_CATALOG.find((t) => norm(t) === a);
  const hitB = TECH_TOOL_CATALOG.find((t) => norm(t) === b);
  if (hitA && hitB && hitA === hitB) return 100;
  return 0;
}

export function technicalTitleRankOf(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (TECH_TITLE_RANKS[t] != null) {
    return TECH_TITLE_RANKS[t] === 0 ? null : TECH_TITLE_RANKS[t];
  }
  const catalog = TECHNICAL_DESIRED_POSITIONS.find((p) => p === t || norm(p) === norm(t));
  if (catalog) {
    const r = TECH_TITLE_RANKS[catalog];
    return r === 0 ? null : r;
  }
  const n = norm(t);
  if (/(quan ly|manager|giam doc|truong phong|plant manager)/.test(n)) return 3;
  if (/(ky su|engineer|\bpe\b|qa\/qc|r&d)/.test(n)) return 2;
  if (/(ky thuat vien|technician|tho |operator|ky thuat)/.test(n)) return 1;
  return null;
}

function titleRankPairS(
  jdTitle: string,
  cvTitle: string,
): { S: number; canh_bao?: string } {
  if (!jdTitle.trim() || !cvTitle.trim()) return { S: 0 };
  if (norm(jdTitle) === norm(cvTitle)) return { S: TECH_TITLE_SCORES.trung_chuc_danh };
  const jdRank = technicalTitleRankOf(jdTitle);
  const cvRank = technicalTitleRankOf(cvTitle);
  if (jdRank == null || cvRank == null) {
    return { S: TECH_TITLE_SCORES.khong_chuan_hoa_duoc, canh_bao: 'chuc_danh_chua_chuan_hoa' };
  }
  if (jdRank === cvRank) return { S: TECH_TITLE_SCORES.cung_cap_khac_chuyen_mon };
  const gap = Math.abs(jdRank - cvRank);
  if (gap === 1) return { S: TECH_TITLE_SCORES.lech_1_cap };
  return { S: TECH_TITLE_SCORES.lech_2_cap };
}

export function desiredTechnicalTitleS(jdTitle: string, cvTitles: string[]): {
  S: number;
  canh_bao?: string;
} {
  if (!jdTitle.trim()) return { S: 0 };
  const usable = cvTitles.map((t) => t.trim()).filter(Boolean);
  if (!usable.length) return { S: 0 };
  let best: { S: number; canh_bao?: string } = { S: 0 };
  for (const title of usable) {
    const row = titleRankPairS(jdTitle, title);
    if (row.S > best.S) best = row;
  }
  return best;
}

export function pastTechnicalTitleS(jdTitle: string, cvTitle: string): {
  S: number;
  canh_bao?: string;
} {
  return titleRankPairS(jdTitle, cvTitle);
}

export function autonomySimilarityS(
  jdLevel: number | null | undefined,
  cvLevel: number | null | undefined,
): number {
  if (jdLevel == null || !Number.isFinite(jdLevel)) return 0;
  if (cvLevel == null || !Number.isFinite(cvLevel)) return 0;
  if (cvLevel >= jdLevel) return TECH_AUTONOMY_SCORES.bang_hoac_hon;
  const gap = jdLevel - cvLevel;
  if (gap === 1) return TECH_AUTONOMY_SCORES.kem_1;
  if (gap === 2) return TECH_AUTONOMY_SCORES.kem_2;
  return TECH_AUTONOMY_SCORES.kem_3_tro_len;
}

function shiftRank(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  const hit = SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.value === v || o.label === v);
  if (hit) {
    if (hit.value === 'no') return 0;
    if (hit.value === 'limited') return 1;
    return 2;
  }
  const n = norm(v);
  if (/khong the|khong san/.test(n)) return 0;
  if (/gioi han|limited/.test(n)) return 1;
  if (/san sang|co,|yes/.test(n)) return 2;
  return null;
}

export function shiftSimilarityS(
  jd: string | null | undefined,
  cv: string | null | undefined,
): number {
  const j = shiftRank(jd);
  const c = shiftRank(cv);
  if (j == null) return 0;
  if (c == null) return 0;
  if (c >= j) return 100;
  if (j - c === 1) return 50;
  return 0;
}

function listCoverageS(jdList: string[], cvList: string[]): number {
  const need = jdList.map((s) => s.trim()).filter((s) => s && s !== 'Chưa có');
  if (!need.length) return 0;
  if (!cvList.length) return 0;
  let hit = 0;
  for (const n of need) {
    const nn = norm(n);
    if (
      cvList.some((c) => {
        const cn = norm(c);
        return cn === nn || cn.includes(nn) || nn.includes(cn);
      })
    ) {
      hit += 1;
    }
  }
  return (100 * hit) / need.length;
}

function isJdFieldFilled(jd: TechnicalMatchJdInput, field: TechnicalMatchFieldCode): boolean {
  switch (field) {
    case 'tech.jd01a':
    case 'tech.jd01b':
      return Boolean(jd.title?.trim());
    case 'tech.jd02':
      return jd.industries.length > 0;
    case 'tech.jd03':
      return Boolean(jd.location?.trim());
    case 'tech.jd04':
      return Boolean(jd.experienceBand);
    case 'tech.jd05':
      return (jd.salaryMin != null && jd.salaryMin > 0) || (jd.salaryMax != null && jd.salaryMax > 0);
    case 'tech.jd08':
      return jd.equipmentSystems.length > 0;
    case 'tech.jd09':
      return jd.workEnvironments.length > 0;
    case 'tech.jd10':
      return jd.technicalWorkTypes.length > 0;
    case 'tech.jd11':
      return jd.autonomyLevel != null;
    case 'tech.jd12':
      return Boolean(jd.educationLevel);
    case 'tech.jd13':
      return Boolean(jd.educationMajor?.trim());
    case 'tech.jd14':
      return jd.languages.length > 0;
    case 'tech.jd15':
      return jd.certificates.length > 0;
    case 'tech.jd16':
      return jd.driverLicenses.filter((l) => l && l !== 'Chưa có').length > 0;
    case 'tech.jd17':
      return Boolean(jd.travelAbility);
    case 'tech.jd18':
      return Boolean(jd.shiftFlexibility);
    case 'tech.jd19':
      return jd.technicalTools.length > 0;
    case 'tech.jd20':
      return jd.documentLiteracy.length > 0;
    default:
      return false;
  }
}

function profileYears(
  profile: TechnicalMatchProfileInput,
  companies: TechnicalMatchCompanyInput[],
  asOfYear: number,
): number | null {
  if (profile.totalExperienceYears != null && Number.isFinite(profile.totalExperienceYears)) {
    return profile.totalExperienceYears;
  }
  const sum = companies.reduce((s, c) => s + companyYearsG2(c, asOfYear), 0);
  return sum > 0 ? sum : null;
}

interface FieldScore {
  field: TechnicalMatchFieldCode;
  S: number;
  K: number;
  weight: number;
  diem: number;
  canh_bao?: string;
}

function scoreFieldS(
  field: TechnicalMatchFieldCode,
  jd: TechnicalMatchJdInput,
  profile: TechnicalMatchProfileInput,
  company: TechnicalMatchCompanyInput | null,
  years: number | null,
): { S: number; canh_bao?: string } {
  switch (field) {
    case 'tech.jd01a':
      return desiredTechnicalTitleS(jd.title ?? '', profile.desiredPositions);
    case 'tech.jd01b':
      return pastTechnicalTitleS(jd.title ?? '', company?.jobTitle ?? '');
    case 'tech.jd02':
      return { S: industrySimilarityC5(company?.industries ?? [], jd.industries) };
    case 'tech.jd03':
      return {
        S: locationSimilarityS(
          jd.location ?? '',
          [...profile.desiredLocations, profile.currentCity ?? ''].filter((s) => s.trim()),
        ),
      };
    case 'tech.jd04':
      return { S: experienceSimilarityS(jd.experienceBand, years) };
    case 'tech.jd05':
      return {
        S: salarySimilarityS(
          jd.salaryMin,
          jd.salaryMax,
          profile.expectedSalaryMin,
          profile.expectedSalaryMax,
          profile.expectedOte,
        ),
      };
    case 'tech.jd08':
      return {
        S: multiSelectCoverageE1(
          company?.equipmentSystems ?? [],
          jd.equipmentSystems,
          equipmentPairSimilarity,
        ),
      };
    case 'tech.jd09':
      return {
        S: multiSelectCoverageE1(
          company?.workEnvironments ?? [],
          jd.workEnvironments,
          environmentPairSimilarity,
        ),
      };
    case 'tech.jd10':
      return {
        S: multiSelectCoverageE1(
          company?.technicalWorkTypes ?? [],
          jd.technicalWorkTypes,
          workTypePairSimilarity,
        ),
      };
    case 'tech.jd11':
      return { S: autonomySimilarityS(jd.autonomyLevel, profile.autonomyLevel) };
    case 'tech.jd12':
      return { S: educationSimilarityS(jd.educationLevel, profile.educationLevel) };
    case 'tech.jd13':
      return { S: majorSimilarityS(jd.educationMajor, profile.educationMajor) };
    case 'tech.jd14':
      return { S: languageSimilarityS(jd.languages, profile.languages, profile.languageSkills) };
    case 'tech.jd15':
      return { S: listCoverageS(jd.certificates, profile.certificates) };
    case 'tech.jd16':
      return { S: listCoverageS(jd.driverLicenses, profile.driverLicenses) };
    case 'tech.jd17':
      return { S: travelSimilarityS(jd.travelAbility, profile.travelAbility) };
    case 'tech.jd18':
      return { S: shiftSimilarityS(jd.shiftFlexibility, profile.shiftFlexibility) };
    case 'tech.jd19':
      return {
        S: multiSelectCoverageE1(profile.technicalTools, jd.technicalTools, toolPairSimilarity),
      };
    case 'tech.jd20':
      return {
        S: multiSelectCoverageE1(
          profile.documentLiteracy,
          jd.documentLiteracy,
          documentPairSimilarity,
        ),
      };
    default:
      return { S: 0 };
  }
}

function applyK(field: TechnicalMatchFieldCode, industryS: number, jdIndustryEmpty: boolean): number {
  if (field === 'tech.jd02') return 1;
  const alpha = TECH_MATCH_FIELD_ALPHA[field];
  if (alpha <= 0) return 1;
  if (jdIndustryEmpty) return 1;
  return industryLeakageK_D1(industryS, alpha);
}

function scoreBlock(
  fields: readonly TechnicalMatchFieldCode[],
  jd: TechnicalMatchJdInput,
  profile: TechnicalMatchProfileInput,
  company: TechnicalMatchCompanyInput | null,
  years: number | null,
  skippedByHardFilter: Set<TechnicalMatchFieldCode>,
): { rows: FieldScore[]; remainingWeight: number; sumPoints: number; normalized: number } {
  const jdIndustryEmpty = !isJdFieldFilled(jd, 'tech.jd02');
  const industryS = jdIndustryEmpty
    ? 100
    : industrySimilarityC5(company?.industries ?? [], jd.industries);
  const rows: FieldScore[] = [];
  let remainingWeight = 0;
  let sumPoints = 0;
  for (const field of fields) {
    if (skippedByHardFilter.has(field)) continue;
    if (!isJdFieldFilled(jd, field)) continue;
    const weight = TECH_MATCH_FIELD_WEIGHTS[field];
    remainingWeight += weight;
    const scored = scoreFieldS(field, jd, profile, company, years);
    const S = scored.S;
    const K = applyK(field, industryS, jdIndustryEmpty);
    const diem = (S / 100) * K * weight;
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
  jd: TechnicalMatchJdInput,
  profile: TechnicalMatchProfileInput,
  companies: TechnicalMatchCompanyInput[],
  years: number | null,
): string[] {
  const reasons: string[] = [];
  for (const key of jd.hardFilters ?? []) {
    const field = JD_KEY_TO_FIELD[key];
    if (!field) continue;
    if (!isJdFieldFilled(jd, field) && key !== 'title') continue;
    let S = 0;
    if (TECH_MATCH_COMPANY_FIELDS.includes(field)) {
      S = Math.max(0, ...companies.map((c) => scoreFieldS(field, jd, profile, c, years).S));
    } else {
      S = scoreFieldS(field, jd, profile, companies[0] ?? null, years).S;
    }
    if (key === 'title') {
      const a = scoreFieldS('tech.jd01a', jd, profile, null, years).S;
      const b = Math.max(
        0,
        ...companies.map((c) => scoreFieldS('tech.jd01b', jd, profile, c, years).S),
      );
      S = Math.max(a, b);
    }
    const minS =
      key === 'industries'
        ? (jd.industryHardMinS ?? TECH_MATCH_CONSTANTS.NGUONG_LOC_CUNG_NGANH_MAC_DINH)
        : 100;
    if (S < minS) {
      reasons.push(`${TECH_MATCH_FIELD_LABEL[field]} (bắt buộc)`);
    }
  }
  return reasons;
}

function skippedHardFilterFields(jd: TechnicalMatchJdInput): Set<TechnicalMatchFieldCode> {
  const out = new Set<TechnicalMatchFieldCode>();
  for (const key of jd.hardFilters ?? []) {
    const field = JD_KEY_TO_FIELD[key];
    if (field) out.add(field);
    if (key === 'title') {
      out.add('tech.jd01a');
      out.add('tech.jd01b');
    }
  }
  return out;
}

function toDetail(row: FieldScore): TechnicalMatchFieldDetail {
  return {
    truong: row.field,
    label: TECH_MATCH_FIELD_LABEL[row.field],
    S: row.S,
    K: row.K,
    trong_so: row.weight,
    diem: row.diem,
    canh_bao: row.canh_bao,
  };
}

function failResult(ly_do: string[]): TechnicalMatchResult {
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
  profile: TechnicalMatchProfileInput,
  companies: TechnicalMatchCompanyInput[],
): TechnicalMatchCompanyInput[] {
  if (companies.length) return companies;
  return [
    {
      ten: profile.currentPosition?.trim() || 'Hồ sơ',
      jobTitle: profile.currentPosition,
      industries: profile.industriesExperienced ?? [],
      equipmentSystems: profile.equipmentSystems ?? [],
      workEnvironments: profile.workEnvironments ?? [],
      technicalWorkTypes: profile.technicalWorkTypes ?? [],
      isCurrent: true,
    },
  ];
}

function round1H6(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scoreTechnicalMatch(input: ScoreTechnicalMatchInput): TechnicalMatchResult {
  const asOfYear = input.asOfYear ?? new Date().getFullYear();
  const companies = ensureCompanies(input.profile, input.companies);
  const years = profileYears(input.profile, companies, asOfYear);
  const skipped = skippedHardFilterFields(input.jd);

  const ly_do = hardFilterFailReasons(input.jd, input.profile, companies, years);
  if (ly_do.length) return failResult(ly_do);

  const profileBlock = scoreBlock(
    TECH_MATCH_PROFILE_FIELDS,
    input.jd,
    input.profile,
    null,
    years,
    skipped,
  );

  const scored = companies.map((company, index) => {
    const block = scoreBlock(
      TECH_MATCH_COMPANY_FIELDS,
      input.jd,
      input.profile,
      company,
      years,
      skipped,
    );
    const P = block.normalized;
    const yrs = companyYearsG2(company, asOfYear);
    const D = durationFactorG2(yrs);
    const R = recencyFactorG3(company, asOfYear);
    const E = P * D * R;
    return { company, index, block, P, D, R, E, yrs };
  });

  scored.sort((a, b) => b.E - a.E || a.index - b.index);
  const best = scored[0];
  const others = scored.slice(1);

  let B = 0;
  if (others.length) {
    const sum = others.reduce((s, row) => s + (row.E / 100) * row.yrs, 0);
    B =
      TECH_MATCH_CONSTANTS.TRAN_THUONG_BE_DAY *
      Math.min(1, sum / TECH_MATCH_CONSTANTS.NGUONG_BE_DAY_NAM);
  }

  const E_best = best?.E ?? 0;
  const diem_kinh_nghiem = E_best + (100 - E_best) * B;
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
      (TECH_MATCH_CONSTANTS.KHOI_CONG_TY / 100) * diem_kinh_nghiem +
      (TECH_MATCH_CONSTANTS.KHOI_CHUNG / 100) * diem_chung;
  }

  const chi_tiet = [...(best?.block.rows ?? []), ...profileBlock.rows].map(toDetail);
  const khoang_thieu = chi_tiet.filter((r) => r.S < 50).map((r) => r.truong);
  const canh_bao = [
    ...new Set(chi_tiet.map((r) => r.canh_bao).filter((x): x is string => Boolean(x))),
  ];

  const cong_ty_tot_nhat: SalesMatchCompanySummary | null = best
    ? { ten: best.company.ten, P: best.P, D: best.D, R: best.R, E: best.E }
    : null;

  return {
    diem_phu_hop: round1H6(diem),
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

export function technicalMatchToExplanation(result: TechnicalMatchResult): MatchExplanation {
  if (!result.dat_loc_cung) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
      reason: `Không đạt điều kiện bắt buộc: ${result.ly_do_loai.join('; ') || 'lọc cứng'}`,
      criteria: [],
      technicalMatch: result,
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
      ? ` Khoảng thiếu: ${result.khoang_thieu.map((k) => TECH_MATCH_FIELD_LABEL[k]).join(', ')}.`
      : '';
  const company = result.cong_ty_tot_nhat ? ` Nền: ${result.cong_ty_tot_nhat.ten}.` : '';
  return {
    score: result.diem_phu_hop ?? 0,
    matchedSkills: [],
    missingSkills: [],
    reason: `Độ phù hợp ${result.diem_phu_hop}% (Kỹ thuật).${company}${weak}`,
    criteria,
    technicalMatch: result,
  };
}

export function shouldUseTechnicalMatchEngine(job: {
  jobTrack?: string | null;
  jobLevel?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
}): boolean {
  const level = job.jobLevel?.trim().toLowerCase() ?? '';
  if (level.startsWith('sales.')) return false;
  if (level.startsWith('technical.')) return true;
  const track = job.jobTrack?.trim().toLowerCase();
  if (track === 'sales') return false;
  if (track === 'technical') return true;
  return job.technicalCriteria != null;
}

export function jobTechnicalCriteriaToMatchJd(
  job: {
    title?: string | null;
    location?: string | null;
    experienceBand?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    industry?: string | null;
  },
  tech: JobTechnicalCriteria | null,
): TechnicalMatchJdInput {
  const industries = tech?.industries?.length
    ? tech.industries
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
    equipmentSystems: tech?.equipmentSystems ?? [],
    workEnvironments: tech?.workEnvironments ?? [],
    technicalWorkTypes: tech?.technicalWorkTypes ?? [],
    autonomyLevel: tech?.autonomyLevel ?? null,
    educationLevel: tech?.educationLevel ?? null,
    educationMajor: tech?.educationMajor ?? null,
    languages: tech?.languages ?? [],
    certificates: tech?.certificates ?? [],
    driverLicenses: (tech?.driverLicenses ?? []).filter((l) => l !== 'Chưa có'),
    travelAbility: tech?.travelAbility ?? null,
    shiftFlexibility: tech?.shiftFlexibility ?? null,
    technicalTools: tech?.technicalTools ?? [],
    documentLiteracy: tech?.documentLiteracy ?? [],
    hardFilters: tech?.hardFilters ?? [],
    industryHardMinS: tech?.industryHardMinS,
  };
}
