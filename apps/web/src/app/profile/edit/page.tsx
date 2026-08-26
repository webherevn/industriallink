'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, Check, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  AVAILABILITY_QUESTION,
  AvailabilityBand,
  CAREER_MOTIVATIONS,
  CAREER_MOTIVATION_QUESTION,
  CAREER_ORIENTATIONS,
  CAREER_ORIENTATION_QUESTION,
  CULTURE_FIT_QUESTIONS,
  CULTURE_FIT_SECTION_TITLE,
  CULTURE_FIT_SUBTITLE,
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  DEAL_VALUE_BANDS,
  DESIRED_LOCATION_OPTIONS,
  DESIRED_POSITIONS,
  DESIRED_POSITION_QUESTION,
  DOCUMENT_LITERACY_OPTIONS,
  DOCUMENT_LITERACY_QUESTION,
  EQUIPMENT_SYSTEM_OPTIONS,
  EQUIPMENT_SYSTEM_QUESTION,
  DRIVER_LICENSE_QUESTION,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  EXPECTED_INCOME_QUESTION,
  JOB_TRACK_LABEL,
  JobTrack,
  KPI_ACHIEVEMENT_BANDS,
  LEGACY_CAREER_ORIENTATION_MAP,
  LEGACY_DESIRED_POSITION_MAP,
  MARKET_REGIONS,
  NEW_CUSTOMER_RATIO_BANDS,
  PERSONAL_REVENUE_QUESTION,
  PRODUCTS_SOLD,
  PRODUCTS_SOLD_QUESTION,
  PROFILE_MISSING_FIELD_LABEL,
  SALES_HIGHLIGHTS_PLACEHOLDER,
  SALES_INDUSTRY_OPTIONS,
  SELLING_STAGES,
  SELLING_STAGES_QUESTION,
  SHIFT_FLEXIBILITY_OPTIONS,
  SHIFT_FLEXIBILITY_QUESTION,
  TECHNICAL_AUTONOMY_LEVELS,
  TECHNICAL_AUTONOMY_QUESTION,
  TECHNICAL_CAREER_MOTIVATIONS,
  TECHNICAL_CAREER_ORIENTATIONS,
  TECHNICAL_DESIRED_POSITIONS,
  TECHNICAL_HIGHLIGHTS_PLACEHOLDER,
  TECHNICAL_HIGHLIGHTS_QUESTION,
  TECHNICAL_MOTIVATION_QUESTION,
  TECHNICAL_ORIENTATION_QUESTION,
  TECHNICAL_POSITION_QUESTION,
  TECHNICAL_TOOLS,
  TECHNICAL_TOOLS_QUESTION,
  TECHNICAL_WORK_STYLES,
  TECHNICAL_WORK_STYLE_QUESTION,
  filterTechnicalWorkStyles,
  TECHNICAL_WORK_TYPES,
  TECHNICAL_WORK_TYPES_QUESTION,
  TRAVEL_ABILITY_LABEL,
  TRAVEL_ABILITY_QUESTION,
  TravelAbility,
  WORK_ENVIRONMENT_ACTUAL_QUESTION,
  WORK_ENVIRONMENT_DESIRED_QUESTION,
  WORK_ENVIRONMENT_OPTIONS,
  cultureFitAnswersToWorkStyles,
  dealValueBandToVnd,
  formatLanguageSkillSummary,
  joinDealTypes,
  joinDriverLicenses,
  kpiBandToPct,
  languageNamesFromSkills,
  mergeLanguageSkills,
  newCustomerBandToPct,
  normalizeCustomerSegment,
  normalizeIndustries,
  normalizeSellingStage,
  parseDriverLicenses,
  splitDealTypes,
  splitExperienceNarrative,
  workStylesToCultureFitAnswers,
  type CultureFitAnswers,
  type CultureFitQuestionId,
  type LanguageSkill,
  type ProfileMissingFieldKey,
  type UpdateCandidateProfileRequest,
  availabilityToNoticeDays,
  noticeDaysToAvailability,
  SkillLevel,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { BrandTechnologySearch } from '@/components/brand-technology-search';
import { LanguageSkillsFields } from '@/components/language-skills-fields';
import { CriteriaCompletionCard } from '@/components/progress-ring';
import { Badge, Button, Card, Field, Input, MoneyInput, MonthYearRangeFields, Select, Textarea, YearInput } from '@/components/ui';
import { VnAddressFields } from '@/components/vn-address-fields';
import { filterCareerMotivations } from '@/lib/career-motivations';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate, updateMyProfile } from '@/lib/candidate';
import {
  completionPercentFromHints,
  fieldHintsFromDraft,
} from '@/lib/cv-from-profile';
import { emptyCvDraft, type CvDraft } from '@/lib/cv-templates';
import { formatVndAmount } from '@/lib/format';

/**
 * Bước 1 = A. Thông tin cơ bản (1–12, chung Kỹ thuật & Kinh doanh)
 * Bước 2 = Chọn hướng hồ sơ
 * Kinh doanh: B 13–16, C 17–19, D 20–34
 * Kỹ thuật: B 13–16, C 17–23, D 24–32
 */
const STEPS = [
  { id: 1, label: 'Thông tin chung' },
  { id: 2, label: 'Lĩnh vực' },
  { id: 3, label: 'Mong muốn' },
  { id: 4, label: 'Định hướng' },
  { id: 5, label: 'Kinh nghiệm' },
  { id: 6, label: 'Xem lại' },
] as const;

const EXPERIENCE_INDUSTRY_OPTIONS = [...SALES_INDUSTRY_OPTIONS, 'Khác'] as const;

function suggestProducts(query: string) {
  const q = query.trim().toLowerCase();
  const pool = PRODUCTS_SOLD.filter((p) => p !== 'Thiết bị công nghiệp khác');
  const matched = !q ? pool : pool.filter((p) => p.toLowerCase().includes(q));
  return matched.map((name) => ({
    name,
    source: 'catalog' as const,
  }));
}

const DEAL_TYPE_CHECK_OPTIONS = DEAL_TYPE_OPTIONS.map((v) => ({
  value: v as string,
  label: DEAL_TYPE_LABEL[v],
}));

type ExperienceRow = {
  id: string | null;
  companyName: string;
  jobTitle: string;
  startYear: string;
  endYear: string;
  isCurrent: boolean;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  brandsTechnologies: string[];
  revenueBand: string;
  latestRevenue: string;
  kpiBand: string;
  kpiAchievementPct: string;
  newCustomerRatioBand: string;
  newCustomerRatioPct: string;
  dealType: string;
  typicalDealValueBand: string;
  typicalDealValue: string;
  maxDealValue: string;
  maxDealRole: string;
  highlights: string;
  jobDescription: string;
  missingFields: string[];
  source: string;
};

type SkillRow = { name: string; level: string };

type FormState = {
  displayName: string;
  phone: string;
  birthYear: string;
  birthDate: string;
  currentCity: string;
  district: string;
  ward: string;
  hobbies: string;
  desiredPositions: string[];
  desiredLocations: string[];
  expectedSalaryMin: string;
  expectedOte: string;
  availabilityBand: string;
  jobReadiness: string;
  experiences: ExperienceRow[];
  languages: string[];
  languageSkills: LanguageSkill[];
  driverLicenses: string[];
  travelAbility: string;
  educationLevel: string;
  educationClassification: string;
  educationSchool: string;
  educationMajor: string;
  certificates: string;
  currentPosition: string;
  jobLevel: string;
  totalExperienceYears: string;
  industry: string;
  industriesExperienced: string[];
  specialization: string;
  summary: string;
  careerObjective: string;
  b2bExperienceBand: string;
  salesHighlights: string;
  dealType: string;
  latestRevenue: string;
  kpiAchievementPct: string;
  newCustomerRatioPct: string;
  typicalDealValue: string;
  maxDealValue: string;
  expectedSalaryMax: string;
  salesBehavior: string;
  careerMotivations: string[];
  cultureFit: CultureFitAnswers;
  careerOrientations: string[];
  skills: SkillRow[];
};

function emptyExperience(): ExperienceRow {
  return {
    id: null,
    companyName: '',
    jobTitle: '',
    startYear: '',
    endYear: '',
    isCurrent: false,
    industries: [],
    productsSold: [],
    customerSegments: [],
    marketsCovered: [],
    sellingStages: [],
    brandsTechnologies: [],
    revenueBand: '',
    latestRevenue: '',
    kpiBand: '',
    kpiAchievementPct: '',
    newCustomerRatioBand: '',
    newCustomerRatioPct: '',
    dealType: '',
    typicalDealValueBand: '',
    typicalDealValue: '',
    maxDealValue: '',
    maxDealRole: '',
    highlights: '',
    jobDescription: '',
    missingFields: [],
    source: 'manual',
  };
}

const EMPTY_FORM: FormState = {
  displayName: '',
  phone: '',
  birthYear: '',
  birthDate: '',
  currentCity: '',
  district: '',
  ward: '',
  hobbies: '',
  desiredPositions: [],
  desiredLocations: [],
  expectedSalaryMin: '',
  expectedOte: '',
  availabilityBand: '',
  jobReadiness: '',
  experiences: [emptyExperience()],
  languages: [],
  languageSkills: [],
  driverLicenses: [],
  travelAbility: '',
  educationLevel: '',
  educationClassification: '',
  educationSchool: '',
  educationMajor: '',
  certificates: '',
  currentPosition: '',
  jobLevel: '',
  totalExperienceYears: '',
  industry: '',
  industriesExperienced: [],
  specialization: '',
  summary: '',
  careerObjective: '',
  b2bExperienceBand: '',
  salesHighlights: '',
  dealType: '',
  latestRevenue: '',
  kpiAchievementPct: '',
  newCustomerRatioPct: '',
  typicalDealValue: '',
  maxDealValue: '',
  expectedSalaryMax: '',
  salesBehavior: '',
  careerMotivations: [],
  cultureFit: {},
  careerOrientations: [],
  skills: [{ name: '', level: SkillLevel.Intermediate }],
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(value: string): number | null {
  const n = parseOptionalNumber(value);
  return n != null ? Math.round(n) : null;
}

/** Form lưu YYYY-MM (từ lịch) hoặc YYYY — trả về năm số. */
function parseYearFromMonthOrYear(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4));
    return Number.isFinite(y) ? y : null;
  }
  return parseOptionalInt(trimmed);
}

function yearToMonthValue(year: number | null | undefined): string {
  if (year == null || !Number.isFinite(year)) return '';
  return `${year}-01`;
}

function formatMonthYearLabel(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-');
    const monthNum = Number(m);
    return Number.isFinite(monthNum) ? `Tháng ${monthNum}/${y}` : `${m}/${y}`;
  }
  return value || '?';
}

function moneyHint(value: string): string | null {
  const n = parseOptionalNumber(value);
  if (n == null || n < 1_000) return null;
  return `≈ ${formatVndAmount(n)}`;
}

function splitCsv(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unionArrays(...lists: string[][]): string[] {
  return [...new Set(lists.flat().filter(Boolean))];
}

function toggleInList(list: string[], item: string, max?: number): string[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  if (max != null && list.length >= max) return list;
  return [...list, item];
}

/** hasB2License suy từ danh sách giấy phép (STT 11). */
function licensesToHasB2(licenses: string[]): boolean | null {
  if (licenses.includes('Ô tô')) return true;
  if (licenses.length > 0) return false;
  return null;
}

/** Chuẩn hoá vị trí mong muốn cũ → 5 lựa chọn bản 18.8. */
function normalizeDesiredPositions(raw: string[]): string[] {
  return [
    ...new Set(
      raw
        .map((p) => {
          const t = p.trim();
          if ((DESIRED_POSITIONS as readonly string[]).includes(t)) return t;
          if ((TECHNICAL_DESIRED_POSITIONS as readonly string[]).includes(t)) return t;
          return LEGACY_DESIRED_POSITION_MAP[t] ?? t;
        })
        .filter(Boolean),
    ),
  ];
}

/** Chuẩn hoá định hướng cũ → 1 lựa chọn bản 18.8 (KD hoặc KT). */
function normalizeCareerOrientations(raw: string[]): string[] {
  for (const o of raw) {
    const t = o.trim().replace(/^Khác:\s*/, 'Khác: ').trim();
    if ((CAREER_ORIENTATIONS as readonly string[]).includes(t)) return [t];
    if ((TECHNICAL_CAREER_ORIENTATIONS as readonly string[]).includes(t)) return [t];
    if (t.startsWith('Khác')) return [t];
    const mapped = LEGACY_CAREER_ORIENTATION_MAP[t];
    if (mapped) return [mapped];
  }
  return [];
}

function experienceFromView(exp: {
  id: string;
  companyName: string;
  jobTitle: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  brandsTechnologies?: string[];
  revenueBand: string | null;
  latestRevenue: number | null;
  kpiBand: string | null;
  kpiAchievementPct: number | null;
  newCustomerRatioBand: string | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValueBand: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  maxDealRole: string | null;
  highlights: string | null;
  jobDescription?: string | null;
  missingFields: ProfileMissingFieldKey[] | string[];
  source: string;
}): ExperienceRow {
  const split = splitExperienceNarrative(exp.jobDescription, exp.highlights);
  return {
    id: exp.id,
    companyName: exp.companyName ?? '',
    jobTitle: exp.jobTitle ?? '',
    startYear: yearToMonthValue(exp.startYear),
    endYear: yearToMonthValue(exp.endYear),
    isCurrent: exp.isCurrent,
    industries: normalizeIndustries(exp.industries ?? []),
    productsSold: [...(exp.productsSold ?? [])],
    customerSegments: [
      ...new Set(
        (exp.customerSegments ?? []).map(
          (s) => normalizeCustomerSegment(s) ?? s,
        ),
      ),
    ],
    marketsCovered: [...(exp.marketsCovered ?? [])],
    sellingStages: [
      ...new Set(
        (exp.sellingStages ?? []).map((s) => normalizeSellingStage(s) ?? s),
      ),
    ],
    brandsTechnologies: [...(exp.brandsTechnologies ?? [])],
    revenueBand: exp.revenueBand ?? '',
    latestRevenue: exp.latestRevenue != null ? String(exp.latestRevenue) : '',
    kpiBand: exp.kpiBand ?? '',
    kpiAchievementPct: exp.kpiAchievementPct != null ? String(exp.kpiAchievementPct) : '',
    newCustomerRatioBand: exp.newCustomerRatioBand ?? '',
    newCustomerRatioPct: exp.newCustomerRatioPct != null ? String(exp.newCustomerRatioPct) : '',
    dealType: exp.dealType ?? '',
    typicalDealValueBand: exp.typicalDealValueBand ?? '',
    typicalDealValue: exp.typicalDealValue != null ? String(exp.typicalDealValue) : '',
    maxDealValue: exp.maxDealValue != null ? String(exp.maxDealValue) : '',
    maxDealRole: exp.maxDealRole ?? '',
    highlights: split.bullets,
    jobDescription: split.jobDescription,
    missingFields: [...(exp.missingFields ?? [])],
    source: exp.source ?? 'manual',
  };
}

type TrackExtras = {
  jobTrack: 'sales' | 'technical' | null;
  brandsTechnologies: string[];
  technicalWorkTypes: string[];
  technicalAutonomyLevel: number | null;
  troubleshootingLevel: number | null;
  technicalTools: string[];
  documentLiteracy: string[];
  systemScaleNote: string | null;
  shiftFlexibility: string | null;
  /** STT 20 KT — cách làm việc kỹ thuật (tối đa 3). */
  technicalWorkStyles: string[];
  /** STT 23 KT — môi trường làm việc mong muốn (tối đa 3). */
  desiredWorkEnvironments: string[];
};

const EMPTY_TRACK: TrackExtras = {
  jobTrack: null,
  brandsTechnologies: [],
  technicalWorkTypes: [],
  technicalAutonomyLevel: null,
  troubleshootingLevel: null,
  technicalTools: [],
  documentLiteracy: [],
  systemScaleNote: null,
  shiftFlexibility: null,
  technicalWorkStyles: [],
  desiredWorkEnvironments: [],
};

function toPayload(form: FormState, track: TrackExtras): UpdateCandidateProfileRequest {
  const experiences = form.experiences
    .filter((e) => e.companyName.trim() || e.jobTitle.trim())
    .map((e) => {
      const latestRevenue =
        parseOptionalNumber(e.latestRevenue) ?? dealValueBandToVnd(e.revenueBand);
      const kpiAchievementPct =
        parseOptionalNumber(e.kpiAchievementPct) ?? kpiBandToPct(e.kpiBand);
      const newCustomerRatioPct =
        parseOptionalNumber(e.newCustomerRatioPct) ??
        newCustomerBandToPct(e.newCustomerRatioBand);
      const typicalDealValue =
        parseOptionalNumber(e.typicalDealValue) ??
        dealValueBandToVnd(e.typicalDealValueBand);
      const maxDealValue = parseOptionalNumber(e.maxDealValue);

      const filledKeys = new Set<string>();
      if (e.productsSold.length) filledKeys.add('products');
      if (e.customerSegments.length) filledKeys.add('customerSegments');
      if (e.marketsCovered.length) filledKeys.add('markets');
      if (latestRevenue != null) filledKeys.add('revenue');
      if (kpiAchievementPct != null) filledKeys.add('kpi');
      if (newCustomerRatioPct != null) filledKeys.add('newCustomerRatio');
      if (typicalDealValue != null) filledKeys.add('dealValue');
      if (maxDealValue != null) filledKeys.add('maxDeal');
      if (e.sellingStages.length) filledKeys.add('sellingStages');

      return {
        id: e.id,
        companyName: e.companyName.trim(),
        jobTitle: e.jobTitle.trim(),
        startYear: parseYearFromMonthOrYear(e.startYear),
        endYear: e.isCurrent ? null : parseYearFromMonthOrYear(e.endYear),
        isCurrent: e.isCurrent,
        industries: e.industries,
        productsSold: e.productsSold,
        customerSegments: e.customerSegments,
        marketsCovered: e.marketsCovered,
        sellingStages: e.sellingStages,
        brandsTechnologies: e.brandsTechnologies,
        revenueBand: e.revenueBand || null,
        latestRevenue,
        kpiBand: e.kpiBand || null,
        kpiAchievementPct,
        newCustomerRatioBand: e.newCustomerRatioBand || null,
        newCustomerRatioPct,
        dealType: e.dealType || null,
        typicalDealValueBand: e.typicalDealValueBand || null,
        typicalDealValue,
        maxDealValue,
        maxDealRole: e.maxDealRole.trim() || null,
        highlights: e.highlights.trim() || null,
        jobDescription: e.jobDescription.trim() || null,
        missingFields: e.missingFields.filter((f) => !filledKeys.has(f)),
        source: e.source || 'manual',
      };
    });

  const productsSold = unionArrays(...experiences.map((e) => e.productsSold));
  const customerSegments = unionArrays(...experiences.map((e) => e.customerSegments));
  const marketsCovered = unionArrays(...experiences.map((e) => e.marketsCovered));
  const sellingStages = unionArrays(...experiences.map((e) => e.sellingStages));
  const industriesExperienced = unionArrays(
    form.industriesExperienced,
    ...experiences.map((e) => e.industries),
  );

  const firstExp = experiences[0];
  const hasB2License = licensesToHasB2(form.driverLicenses);

  return {
    displayName: form.displayName.replace(/\r/g, '').trim(),
    phone: form.phone.trim() || null,
    birthYear: parseOptionalInt(form.birthYear),
    birthDate: form.birthDate.trim() || null,
    currentCity: form.currentCity.trim() || null,
    district: form.district.trim() || null,
    ward: form.ward.trim() || null,
    currentPosition:
      form.currentPosition.trim() || form.desiredPositions[0] || firstExp?.jobTitle || null,
    jobLevel: form.jobLevel.trim() || null,
    totalExperienceYears: parseOptionalNumber(form.totalExperienceYears),
    industry: form.industry.trim() || firstExp?.industries[0] || null,
    industriesExperienced,
    specialization: form.specialization.trim() || null,
    summary: form.summary.trim() || null,
    careerObjective: form.careerObjective.trim() || null,
    hobbies: splitCsv(form.hobbies),
    productsSold,
    customerSegments,
    b2bExperienceBand: form.b2bExperienceBand || null,
    marketsCovered,
    salesHighlights: form.salesHighlights.trim() || null,
    customerDevStyle: form.salesBehavior || null,
    dealType: form.dealType || firstExp?.dealType || null,
    latestRevenue:
      parseOptionalNumber(form.latestRevenue) ?? firstExp?.latestRevenue ?? null,
    kpiAchievementPct:
      parseOptionalNumber(form.kpiAchievementPct) ?? firstExp?.kpiAchievementPct ?? null,
    newCustomerRatioPct:
      parseOptionalNumber(form.newCustomerRatioPct) ??
      firstExp?.newCustomerRatioPct ??
      null,
    typicalDealValue:
      parseOptionalNumber(form.typicalDealValue) ?? firstExp?.typicalDealValue ?? null,
    maxDealValue: parseOptionalNumber(form.maxDealValue) ?? firstExp?.maxDealValue ?? null,
    sellingStages,
    jobReadiness: form.jobReadiness || null,
    availabilityBand: form.availabilityBand || null,
    noticePeriodDays: availabilityToNoticeDays(form.availabilityBand),
    expectedSalaryMin: parseOptionalNumber(form.expectedSalaryMin),
    expectedSalaryMax: parseOptionalNumber(form.expectedSalaryMax),
    expectedOte: parseOptionalNumber(form.expectedOte),
    languages: languageNamesFromSkills(
      mergeLanguageSkills(form.languages, form.languageSkills),
    ),
    languageSkills: mergeLanguageSkills(form.languages, form.languageSkills),
    hasB2License,
    driverLicenseType: joinDriverLicenses(form.driverLicenses),
    willingToTravel: form.travelAbility
      ? form.travelAbility !== TravelAbility.None
      : null,
    travelAbility: form.travelAbility || null,
    desiredPositions: form.desiredPositions,
    desiredLocations: form.desiredLocations,
    careerMotivations: filterCareerMotivations(form.careerMotivations, track.jobTrack),
    workStyles:
      track.jobTrack === JobTrack.Technical
        ? track.technicalWorkStyles.slice(0, 3)
        : cultureFitAnswersToWorkStyles(form.cultureFit),
    careerOrientations: form.careerOrientations,
    salesBehavior: form.salesBehavior || null,
    careerOrientation: form.careerOrientations.length
      ? form.careerOrientations.join(' | ')
      : null,
    educationLevel: form.educationLevel || null,
    educationClassification: form.educationClassification || null,
    educationSchool: form.educationSchool.trim() || null,
    educationMajor: form.educationMajor.trim() || null,
    certificates: splitCsv(form.certificates),
    skills: form.skills
      .map((s) => ({ name: s.name.replace(/\r/g, '').trim(), level: s.level || SkillLevel.Intermediate }))
      .filter((s) => s.name.length > 0),
    experiences,
    jobTrack: track.jobTrack,
    brandsTechnologies: (() => {
      const fromExp = unionArrays(...experiences.map((e) => e.brandsTechnologies ?? []));
      return fromExp.length ? fromExp : track.brandsTechnologies;
    })(),
    technicalWorkTypes:
      track.jobTrack === JobTrack.Technical
        ? unionArrays(track.technicalWorkTypes, ...experiences.map((e) => e.sellingStages))
        : track.technicalWorkTypes,
    technicalAutonomyLevel: track.technicalAutonomyLevel,
    troubleshootingLevel: track.troubleshootingLevel,
    technicalTools: track.technicalTools,
    documentLiteracy: track.documentLiteracy,
    systemScaleNote: track.systemScaleNote,
    shiftFlexibility: track.shiftFlexibility,
    desiredWorkEnvironments: track.desiredWorkEnvironments,
  };
}

function MultiCheck({
  options,
  selected,
  onChange,
  max,
  columns = 2,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={clsx(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {options.map((opt) => {
        const checked = selected.includes(opt);
        const disabled = !checked && max != null && selected.length >= max;
        return (
          <label
            key={opt}
            className={clsx(
              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
              checked
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(toggleInList(selected, opt, max))}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function RadioList({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const checked = value === opt;
        return (
          <label
            key={opt}
            className={clsx(
              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
              checked
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <input
              type="radio"
              name={name}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              onChange={() => onChange(opt)}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Chọn nhiều + nhập thêm — STT 24 / 13 KT / 28 KT. `searchable` = PDF “Search + chọn nhiều”. */
function MultiCheckWithCustom({
  options,
  selected,
  onChange,
  placeholder,
  max,
  searchable,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  searchable?: boolean;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const customSelected = selected.filter((s) => !(options as readonly string[]).includes(s));
  const q = query.trim().toLowerCase();
  const visibleOptions =
    searchable && q
      ? options.filter((o) => o.toLowerCase().includes(q) || selected.includes(o))
      : options;

  function addCustom() {
    const v = text.trim();
    if (!v || selected.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...selected, v].slice(0, max ?? Number.POSITIVE_INFINITY));
    setText('');
  }

  return (
    <div className="space-y-2">
      {searchable && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm trong danh sách…"
        />
      )}
      <MultiCheck options={visibleOptions} selected={selected} onChange={onChange} max={max} columns={2} />
      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customSelected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s !== item))}
                className="text-brand-400 hover:text-brand-700"
                aria-label={`Xoá ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder ?? 'Nhập thêm mục khác…'}
        />
        <Button type="button" variant="outline" onClick={addCustom} disabled={!text.trim()}>
          + Thêm
        </Button>
      </div>
    </div>
  );
}

function MissingBadges({ fields, highlight }: { fields: string[]; highlight?: boolean }) {
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((key) => (
        <Badge key={key} tone={highlight ? 'amber' : 'slate'}>
          Thiếu: {PROFILE_MISSING_FIELD_LABEL[key as ProfileMissingFieldKey] ?? key}
        </Badge>
      ))}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function formatVnd(value: string): string {
  const n = parseOptionalNumber(value);
  if (n == null) return '';
  return new Intl.NumberFormat('vi-VN').format(n) + ' VND';
}

function ChooseTrackNote() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      Hãy quay lại bước <span className="font-semibold">Lĩnh vực</span> và chọn{' '}
      <span className="font-semibold">Kinh doanh</span> hoặc{' '}
      <span className="font-semibold">Kỹ thuật</span> để hiện đúng bộ câu hỏi.
    </div>
  );
}

/** Map form hồ sơ → CvDraft để tính % theo tiêu chí KD/KT (không đổi UI form). */
function draftFromEditForm(form: FormState, track: TrackExtras, email = ''): CvDraft {
  const experience = form.experiences
    .filter((e) => e.companyName.trim() || e.jobTitle.trim())
    .map((e) => ({
      role: e.jobTitle.trim() || form.currentPosition || 'Vị trí',
      company: e.companyName.trim() || 'Công ty',
      period: [
        e.startYear,
        e.isCurrent ? 'Hiện tại' : e.endYear,
      ]
        .filter(Boolean)
        .join(' – '),
      bullets: e.highlights.trim(),
      jobDescription: e.jobDescription.trim(),
      industries: e.industries,
      productsSold: e.productsSold,
      customerSegments: e.customerSegments,
      marketsCovered: e.marketsCovered,
      sellingStages: e.sellingStages,
      brandsTechnologies: e.brandsTechnologies,
      latestRevenue:
        parseOptionalNumber(e.latestRevenue) ?? dealValueBandToVnd(e.revenueBand),
      kpiAchievementPct:
        parseOptionalNumber(e.kpiAchievementPct) ?? kpiBandToPct(e.kpiBand),
      newCustomerRatioPct:
        parseOptionalNumber(e.newCustomerRatioPct) ??
        newCustomerBandToPct(e.newCustomerRatioBand),
      dealType: e.dealType || null,
      typicalDealValue:
        parseOptionalNumber(e.typicalDealValue) ??
        dealValueBandToVnd(e.typicalDealValueBand),
      maxDealValue: parseOptionalNumber(e.maxDealValue),
    }));

  const productsSold = unionArrays(
    ...form.experiences.map((e) => e.productsSold),
  );
  const customerSegments = unionArrays(
    ...form.experiences.map((e) => e.customerSegments),
  );
  const marketsCovered = unionArrays(
    ...form.experiences.map((e) => e.marketsCovered),
  );
  const hasB2License = licensesToHasB2(form.driverLicenses);

  return {
    ...emptyCvDraft(form.displayName, email),
    title: form.currentPosition.trim() || form.desiredPositions[0] || '',
    phone: form.phone.trim(),
    location: form.currentCity.trim(),
    summary: form.summary.trim(),
    birthYear: parseOptionalInt(form.birthYear),
    birthDate: form.birthDate.trim() || null,
    ward: form.ward.trim() || null,
    educationLevel: form.educationLevel || null,
    educationClassification: form.educationClassification || null,
    educationMajor: form.educationMajor.trim() || null,
    careerObjective: form.careerObjective.trim() || null,
    skills: form.skills.map((s) => s.name.trim()).filter(Boolean),
    languages: form.languages,
    languageSkills: mergeLanguageSkills(form.languages, form.languageSkills),
    hobbies: splitCsv(form.hobbies),
    productsSold,
    customerSegments,
    marketsCovered,
    industriesExperienced: form.industriesExperienced,
    desiredPositions: form.desiredPositions,
    desiredLocations: form.desiredLocations,
    salesHighlights:
      form.salesHighlights.trim() ||
      form.experiences.find((e) => e.highlights.trim())?.highlights.trim() ||
      '',
    b2bExperienceBand: form.b2bExperienceBand || null,
    newCustomerRatioPct: parseOptionalNumber(form.newCustomerRatioPct),
    dealType: form.dealType || null,
    typicalDealValue: parseOptionalNumber(form.typicalDealValue),
    maxDealValue: parseOptionalNumber(form.maxDealValue),
    jobReadiness: form.jobReadiness || null,
    availabilityBand: form.availabilityBand || null,
    expectedSalaryMin: parseOptionalNumber(form.expectedSalaryMin),
    expectedSalaryMax: parseOptionalNumber(form.expectedSalaryMax),
    expectedOte: parseOptionalNumber(form.expectedOte),
    travelAbility: form.travelAbility || null,
    hasB2License,
    driverLicenseType: joinDriverLicenses(form.driverLicenses),
    salesBehavior: form.salesBehavior || null,
    careerMotivations: filterCareerMotivations(form.careerMotivations, track.jobTrack),
    careerOrientations: form.careerOrientations,
    workStyles:
      track.jobTrack === JobTrack.Technical
        ? track.technicalWorkStyles.slice(0, 3)
        : cultureFitAnswersToWorkStyles(form.cultureFit),
    jobTrack: track.jobTrack,
    brandsTechnologies: (() => {
      const fromExp = unionArrays(...form.experiences.map((e) => e.brandsTechnologies ?? []));
      return fromExp.length ? fromExp : track.brandsTechnologies;
    })(),
    technicalWorkTypes:
      track.jobTrack === JobTrack.Technical
        ? unionArrays(track.technicalWorkTypes, ...form.experiences.map((e) => e.sellingStages))
        : track.technicalWorkTypes,
    technicalAutonomyLevel: track.technicalAutonomyLevel,
    troubleshootingLevel: track.troubleshootingLevel,
    technicalTools: track.technicalTools,
    documentLiteracy: track.documentLiteracy,
    systemScaleNote: track.systemScaleNote,
    shiftFlexibility: track.shiftFlexibility,
    desiredWorkEnvironments: track.desiredWorkEnvironments,
    experience,
    education:
      form.educationSchool.trim() ||
      form.educationMajor.trim() ||
      form.educationClassification ||
      form.educationLevel
        ? [
            {
              school: form.educationSchool.trim(),
              degree: [form.educationClassification, form.educationMajor.trim()]
                .filter(Boolean)
                .join(' — '),
              period: '',
            },
          ]
        : [],
    certificates: splitCsv(form.certificates),
  };
}

export default function ProfileEditPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: candidate, isLoading, isError, error } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
  });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [trackExtras, setTrackExtras] = useState<TrackExtras>(EMPTY_TRACK);
  const [hydrated, setHydrated] = useState(false);
  const [cvEntry, setCvEntry] = useState(false);

  useEffect(() => {
    if (!candidate || hydrated) return;
    const p = candidate.profile;
    const sales = p?.sales;
    const exps =
      candidate.experiences.length > 0
        ? candidate.experiences.map(experienceFromView)
        : [emptyExperience()];
    if (
      p?.jobTrack === JobTrack.Technical &&
      (p.technicalWorkTypes?.length ?? 0) > 0 &&
      exps[0] &&
      exps[0].sellingStages.length === 0
    ) {
      exps[0] = { ...exps[0], sellingStages: [...(p.technicalWorkTypes ?? [])] };
    }
    const hasCvAi = candidate.experiences.some((e) => e.source === 'cv_ai');

    const licenses = parseDriverLicenses(sales?.driverLicenseType);
    if (licenses.length === 0) {
      if (sales?.hasB2License === true) licenses.push('Ô tô');
      else if (sales?.hasB2License === false) licenses.push('Chưa có');
    }

    setForm({
      displayName: candidate.displayName ?? '',
      phone: p?.phone ?? '',
      birthYear: p?.birthYear != null ? String(p.birthYear) : '',
      birthDate: p?.birthDate ?? '',
      currentCity: p?.currentCity ?? '',
      district: p?.district ?? '',
      ward: p?.ward ?? '',
      hobbies: (p?.hobbies ?? []).join(', '),
      desiredPositions: normalizeDesiredPositions([...(sales?.desiredPositions ?? [])]),
      desiredLocations: [...(sales?.desiredLocations ?? [])],
      expectedSalaryMin: sales?.expectedSalaryMin != null ? String(sales.expectedSalaryMin) : '',
      expectedOte: sales?.expectedOte != null ? String(sales.expectedOte) : '',
      availabilityBand:
        sales?.availabilityBand ??
        noticeDaysToAvailability(sales?.noticePeriodDays ?? null) ??
        '',
      jobReadiness: sales?.jobReadiness ?? '',
      experiences: exps,
      languages: [...(sales?.languages ?? [])],
      languageSkills: mergeLanguageSkills(
        sales?.languages ?? [],
        sales?.languageSkills ?? [],
      ),
      driverLicenses: licenses,
      travelAbility: sales?.travelAbility ?? '',
      educationLevel: p?.educationLevel ?? '',
      educationClassification: p?.educationClassification ?? '',
      educationSchool: p?.educationSchool ?? '',
      educationMajor: p?.educationMajor ?? '',
      certificates: (p?.certificates ?? []).join(', '),
      currentPosition: p?.currentPosition ?? '',
      jobLevel: p?.jobLevel ?? '',
      totalExperienceYears:
        p?.totalExperienceYears != null ? String(p.totalExperienceYears) : '',
      industry: p?.industry ?? '',
      industriesExperienced: [...(p?.industriesExperienced ?? [])],
      specialization: p?.specialization ?? '',
      summary: p?.summary ?? '',
      careerObjective: p?.careerObjective ?? '',
      b2bExperienceBand: sales?.b2bExperienceBand ?? '',
      salesHighlights: sales?.salesHighlights ?? '',
      dealType: sales?.dealType ?? '',
      latestRevenue: sales?.latestRevenue != null ? String(sales.latestRevenue) : '',
      kpiAchievementPct:
        sales?.kpiAchievementPct != null ? String(sales.kpiAchievementPct) : '',
      newCustomerRatioPct:
        sales?.newCustomerRatioPct != null ? String(sales.newCustomerRatioPct) : '',
      typicalDealValue: sales?.typicalDealValue != null ? String(sales.typicalDealValue) : '',
      maxDealValue: sales?.maxDealValue != null ? String(sales.maxDealValue) : '',
      expectedSalaryMax: sales?.expectedSalaryMax != null ? String(sales.expectedSalaryMax) : '',
      salesBehavior: sales?.salesBehavior ?? sales?.customerDevStyle ?? '',
      careerMotivations: filterCareerMotivations(sales?.careerMotivations, p?.jobTrack),
      cultureFit: workStylesToCultureFitAnswers(sales?.workStyles),
      careerOrientations: normalizeCareerOrientations([
        ...((sales?.careerOrientations?.length
          ? sales.careerOrientations
          : sales?.careerOrientation
            ? sales.careerOrientation
                .split(/\s*\|\s*/)
                .map((s) => s.trim())
                .filter(Boolean)
            : []) ?? []),
      ]),
      skills:
        candidate.skills.length > 0
          ? candidate.skills.map((s) => ({ name: s.name, level: s.level }))
          : [],
    });

    setTrackExtras({
      jobTrack: p?.jobTrack ?? null,
      brandsTechnologies: [...(p?.brandsTechnologies ?? [])],
      technicalWorkTypes: [...(p?.technicalWorkTypes ?? [])],
      technicalAutonomyLevel: p?.technicalAutonomyLevel ?? null,
      troubleshootingLevel: p?.troubleshootingLevel ?? null,
      technicalTools: [...(p?.technicalTools ?? [])],
      documentLiteracy: [...(p?.documentLiteracy ?? [])],
      systemScaleNote: p?.systemScaleNote ?? null,
      shiftFlexibility: p?.shiftFlexibility ?? null,
      technicalWorkStyles: filterTechnicalWorkStyles(sales?.workStyles),
      desiredWorkEnvironments: [...(p?.desiredWorkEnvironments ?? [])],
    });

    if (hasCvAi) {
      setStep(5);
      setCvEntry(true);
    }
    setHydrated(true);
  }, [candidate, hydrated]);

  const liveHints = useMemo(
    () => fieldHintsFromDraft(draftFromEditForm(form, trackExtras)),
    [form, trackExtras],
  );
  const criteriaPercent = useMemo(
    () => completionPercentFromHints(liveHints, trackExtras.jobTrack),
    [liveHints, trackExtras.jobTrack],
  );
  const filledCriteria = liveHints.filter((f) => f.status === 'filled');
  const criteriaGaps = liveHints.filter(
    (f) => f.status === 'missing' || f.status === 'weak',
  );

  const saveMutation = useMutation({
    mutationFn: () => updateMyProfile(toPayload(form, trackExtras)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['my-candidate'] });
      router.push('/dashboard');
    },
  });

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function patchCultureFit(id: CultureFitQuestionId, value: string) {
    setForm((prev) => ({
      ...prev,
      cultureFit: { ...prev.cultureFit, [id]: value },
    }));
  }

  function toggleDriverLicense(item: string) {
    setForm((prev) => {
      let next: string[];
      if (prev.driverLicenses.includes(item)) {
        next = prev.driverLicenses.filter((x) => x !== item);
      } else if (item === 'Chưa có') {
        next = ['Chưa có'];
      } else {
        next = [...prev.driverLicenses.filter((x) => x !== 'Chưa có'), item];
      }
      return { ...prev, driverLicenses: next };
    });
  }

  function patchExperience(index: number, patchExp: Partial<ExperienceRow>) {
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.map((e, i) => (i === index ? { ...e, ...patchExp } : e)),
    }));
  }

  function addExperience() {
    setForm((prev) => ({
      ...prev,
      experiences: [...prev.experiences, emptyExperience()],
    }));
  }

  function removeExperience(index: number) {
    setForm((prev) => ({
      ...prev,
      experiences:
        prev.experiences.length <= 1
          ? prev.experiences
          : prev.experiences.filter((_, i) => i !== index),
    }));
  }

  const isSales = trackExtras.jobTrack === JobTrack.Sales;
  const isTechnical = trackExtras.jobTrack === JobTrack.Technical;

  const stepValid = useMemo(() => {
    if (step === 1) {
      return (
        form.displayName.trim().length > 0 &&
        form.phone.trim().length > 0 &&
        form.currentCity.trim().length > 0 &&
        form.travelAbility.trim().length > 0
      );
    }
    if (step === 2) return trackExtras.jobTrack != null;
    if (step === 3 && (isSales || isTechnical)) {
      return (
        form.desiredPositions.length > 0 &&
        form.desiredLocations.length > 0 &&
        (parseOptionalNumber(form.expectedSalaryMin) != null ||
          parseOptionalNumber(form.expectedOte) != null) &&
        form.availabilityBand.trim().length > 0
      );
    }
    if (step === 5 && (isSales || isTechnical)) {
      return form.experiences.every((e) => {
        if (!e.companyName.trim() && !e.jobTitle.trim()) return true;
        return e.companyName.trim().length > 0 && e.jobTitle.trim().length > 0;
      });
    }
    return true;
  }, [step, form, trackExtras.jobTrack, isSales, isTechnical]);

  const filledExperiences = form.experiences.filter(
    (e) => e.companyName.trim() || e.jobTitle.trim(),
  );

  function scrollPageTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    if (!stepValid || step >= 6) return;
    setStep(step + 1);
    scrollPageTop();
  }

  function goBack() {
    if (step <= 1) return;
    setStep(step - 1);
    scrollPageTop();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Hồ sơ ứng viên IndustrialLink
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Hoàn thiện hồ sơ</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mục 1–12: thông tin chung. Sau đó chọn Kinh doanh / Kỹ thuật — chọn Kinh doanh sẽ
              hiện các mục 13–34.
            </p>
          </div>
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Huỷ
            </Button>
          </Link>
        </div>

        {isLoading && <p className="text-sm text-slate-500">Đang tải hồ sơ...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error instanceof ApiError ? error.message : 'Không tải được hồ sơ'}
          </p>
        )}

        {candidate && hydrated && (
          <>
            <CriteriaCompletionCard
              title="Tiến độ hoàn thiện hồ sơ"
              percent={criteriaPercent}
              filledCount={filledCriteria.length}
              totalCount={liveHints.length}
              gaps={criteriaGaps}
            />

            <nav className="overflow-x-auto">
              <ol className="flex min-w-max items-center gap-1 sm:gap-2">
                {STEPS.map((s, idx) => {
                  const active = step === s.id;
                  const done = step > s.id;
                  return (
                    <li key={s.id} className="flex items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep(s.id);
                          scrollPageTop();
                        }}
                        className={clsx(
                          'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition',
                          active && 'bg-brand-600 text-white',
                          !active && done && 'bg-brand-50 text-brand-700',
                          !active && !done && 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <span
                          className={clsx(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                            active && 'bg-white/20',
                            !active && done && 'bg-brand-600 text-white',
                            !active && !done && 'bg-slate-200 text-slate-600',
                          )}
                        >
                          {done && !active ? <Check className="h-3.5 w-3.5" /> : s.id}
                        </span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </button>
                      {idx < STEPS.length - 1 && (
                        <span className="hidden h-px w-4 bg-slate-200 sm:block md:w-6" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            {cvEntry && step === 5 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                AI đã trích xuất kinh nghiệm từ CV. Vui lòng kiểm tra và bổ sung các mục được
                đánh dấu <Badge tone="amber">Thiếu</Badge> bên dưới.
              </div>
            )}

            <Card className="space-y-5">
              {step === 1 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-accent-600">
                        A. Thông tin cơ bản (1–12)
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Phần chung cho cả hồ sơ Kỹ thuật và Kinh doanh.
                      </p>
                    </div>
                    <Link href="/upload">
                      <Button type="button" variant="outline" className="text-brand-700">
                        Có CV? Tải để AI điền
                      </Button>
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="1. Họ và tên *">
                      <Input
                        value={form.displayName}
                        onChange={(e) => patch('displayName', e.target.value)}
                        maxLength={200}
                        required
                      />
                    </Field>
                    <Field label="2. Năm sinh">
                      <YearInput
                        value={form.birthYear}
                        onChange={(v) => patch('birthYear', v)}
                      />
                    </Field>
                    <Field label="3. Số điện thoại *">
                      <Input
                        value={form.phone}
                        onChange={(e) => patch('phone', e.target.value)}
                        placeholder="090x xxx xxx"
                        required
                      />
                    </Field>
                    <Field label="4. Email *">
                      <Input value={me?.email ?? ''} disabled readOnly />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Email tài khoản — đổi tại trang Tài khoản.
                      </p>
                    </Field>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-semibold text-slate-800">
                      5. Nơi đang sinh sống *
                    </p>
                    <p className="mb-2 text-xs text-slate-500">
                      Địa chỉ hành chính mới từ 01/7/2025
                    </p>
                    <VnAddressFields
                      ward={form.ward}
                      province={form.currentCity}
                      onChange={(p) => {
                        if (p.ward !== undefined) patch('ward', p.ward);
                        if (p.province !== undefined) patch('currentCity', p.province);
                        // Không còn cấp huyện
                        patch('district', '');
                      }}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="6. Trình độ học vấn">
                      <Select
                        value={form.educationLevel}
                        onChange={(e) => patch('educationLevel', e.target.value)}
                      >
                        <option value="">— Trình độ đào tạo cao nhất —</option>
                        {EDUCATION_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="7. Trường học">
                      <Input
                        value={form.educationSchool}
                        onChange={(e) => patch('educationSchool', e.target.value)}
                        placeholder="Anh/chị học trường nào?"
                      />
                    </Field>
                    <Field label="8. Chuyên ngành">
                      <Input
                        value={form.educationMajor}
                        onChange={(e) => patch('educationMajor', e.target.value)}
                        placeholder="VD: Điện tử viễn thông, Marketing..."
                      />
                    </Field>
                  </div>
                  <Field label="9. Chứng chỉ / chứng nhận chuyên môn (cách nhau bằng dấu phẩy)">
                    <Input
                      value={form.certificates}
                      onChange={(e) => patch('certificates', e.target.value)}
                      placeholder="VD: ISO 9001, An toàn lao động..."
                    />
                  </Field>
                  <Field label="10. Ngoại ngữ sử dụng trong công việc">
                    <LanguageSkillsFields
                      languages={form.languages}
                      languageSkills={form.languageSkills}
                      onChange={({ languages, languageSkills }) =>
                        setForm((prev) => ({ ...prev, languages, languageSkills }))
                      }
                    />
                  </Field>
                  <Field
                    label="11. Giấy phép lái xe"
                    description={DRIVER_LICENSE_QUESTION}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DRIVER_LICENSE_TYPES.map((opt) => {
                        const checked = form.driverLicenses.includes(opt);
                        return (
                          <label
                            key={opt}
                            className={clsx(
                              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                              checked
                                ? 'border-brand-300 bg-brand-50 text-brand-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              checked={checked}
                              onChange={() => toggleDriverLicense(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                  <Field
                    label="12. Khả năng đi công tác *"
                    description={TRAVEL_ABILITY_QUESTION}
                  >
                    <Select
                      value={form.travelAbility}
                      onChange={(e) => patch('travelAbility', e.target.value)}
                    >
                      <option value="">— Chọn —</option>
                      {Object.values(TravelAbility).map((v) => (
                        <option key={v} value={v}>
                          {TRAVEL_ABILITY_LABEL[v]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Chọn hướng hồ sơ *
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Sau phần thông tin chung (1–12), chọn Kinh doanh (mục 13–34) hoặc Kỹ thuật
                      (mục 13–32).
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          track: JobTrack.Sales,
                          icon: Briefcase,
                          desc: 'Sales B2B công nghiệp — hiện đầy đủ các mục 13–34 (mong muốn, định hướng, kinh nghiệm bán hàng).',
                        },
                        {
                          track: JobTrack.Technical,
                          icon: Wrench,
                          desc: 'Kỹ thuật / dịch vụ kỹ thuật — hiện đầy đủ các mục 13–32 (mong muốn, năng lực, kinh nghiệm kỹ thuật).',
                        },
                      ] as const
                    ).map(({ track, icon: Icon, desc }) => {
                      const active = trackExtras.jobTrack === track;
                      return (
                        <button
                          key={track}
                          type="button"
                          onClick={() =>
                            setTrackExtras((prev) => ({ ...prev, jobTrack: track }))
                          }
                          className={clsx(
                            'rounded-xl border-2 p-4 text-left transition',
                            active
                              ? 'border-brand-500 bg-brand-50/60 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-brand-200',
                          )}
                        >
                          <span
                            className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-xl',
                              active
                                ? 'bg-brand-500 text-white'
                                : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <p className="mt-3 text-sm font-bold text-slate-900">
                            {JOB_TRACK_LABEL[track]}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="text-lg font-semibold text-accent-600">
                    B. Mong muốn nghề nghiệp (13–16)
                  </h2>
                  {!trackExtras.jobTrack && <ChooseTrackNote />}
                  {(isSales || isTechnical) && (
                    <>
                      {isSales ? (
                        <Field
                          label="13. Vị trí ứng tuyển *"
                          description={DESIRED_POSITION_QUESTION}
                        >
                          <MultiCheck
                            options={DESIRED_POSITIONS}
                            selected={form.desiredPositions}
                            onChange={(v) => patch('desiredPositions', v)}
                            columns={2}
                          />
                        </Field>
                      ) : (
                        <Field
                          label="13. Vị trí ứng tuyển *"
                          description={TECHNICAL_POSITION_QUESTION}
                        >
                          <p className="mb-2 text-xs text-amber-700">
                            {`Tối đa 3 (${form.desiredPositions.length}/3)`}
                          </p>
                          <MultiCheckWithCustom
                            options={TECHNICAL_DESIRED_POSITIONS}
                            selected={form.desiredPositions}
                            onChange={(v) => patch('desiredPositions', v.slice(0, 3))}
                            max={3}
                            placeholder="Khác — nhập vị trí…"
                          />
                        </Field>
                      )}
                      <Field
                        label="14. Địa điểm mong muốn làm việc *"
                        description="Anh/chị có thể làm việc ở đâu?"
                      >
                        <MultiCheck
                          options={DESIRED_LOCATION_OPTIONS}
                          selected={form.desiredLocations}
                          onChange={(v) => patch('desiredLocations', v)}
                          columns={2}
                        />
                      </Field>
                      <Field
                        label="15. Thu nhập *"
                        description={EXPECTED_INCOME_QUESTION}
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <MoneyInput
                            value={form.expectedSalaryMin}
                            onChange={(v) => patch('expectedSalaryMin', v)}
                            placeholder="Thu nhập tối thiểu có thể nhận"
                            hint={moneyHint(form.expectedSalaryMin)}
                          />
                          <MoneyInput
                            value={form.expectedOte}
                            onChange={(v) => patch('expectedOte', v)}
                            placeholder="Thu nhập kỳ vọng/tháng"
                            hint={moneyHint(form.expectedOte)}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Thu nhập tối thiểu có thể nhận + thu nhập kỳ vọng/tháng (VND).
                        </p>
                      </Field>
                      <Field
                        label="16. Thời gian có thể nhận việc *"
                        description={AVAILABILITY_QUESTION}
                      >
                        <Select
                          value={form.availabilityBand}
                          onChange={(e) => patch('availabilityBand', e.target.value)}
                        >
                          <option value="">— Chọn —</option>
                          {Object.values(AvailabilityBand).map((v) => (
                            <option key={v} value={v}>
                              {AVAILABILITY_BAND_LABEL[v]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="text-lg font-semibold text-accent-600">
                    {isTechnical
                      ? 'C. Năng lực và định hướng (17–23)'
                      : 'C. Định hướng & phù hợp (17–19)'}
                  </h2>
                  {!trackExtras.jobTrack && <ChooseTrackNote />}
                  {isTechnical && (
                    <>
                      <Field
                        label="17. Khả năng làm ngoài giờ"
                        description={SHIFT_FLEXIBILITY_QUESTION}
                      >
                        <RadioList
                          name="shiftFlexibility"
                          options={SHIFT_FLEXIBILITY_OPTIONS.map((o) => o.label)}
                          value={
                            SHIFT_FLEXIBILITY_OPTIONS.find(
                              (o) => o.value === trackExtras.shiftFlexibility,
                            )?.label ?? ''
                          }
                          onChange={(label) => {
                            const opt = SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.label === label);
                            setTrackExtras((prev) => ({
                              ...prev,
                              shiftFlexibility: opt ? opt.value : null,
                            }));
                          }}
                        />
                      </Field>
                      <Field
                        label="18. Phần mềm & công cụ đã sử dụng"
                        description={TECHNICAL_TOOLS_QUESTION}
                      >
                        <MultiCheckWithCustom
                          options={TECHNICAL_TOOLS}
                          selected={trackExtras.technicalTools}
                          onChange={(v) =>
                            setTrackExtras((prev) => ({ ...prev, technicalTools: v }))
                          }
                          placeholder="Khác — VD: EPLAN, TIA Portal…"
                        />
                      </Field>
                      <Field
                        label="19. Đọc bản vẽ / tài liệu"
                        description={DOCUMENT_LITERACY_QUESTION}
                      >
                        <MultiCheckWithCustom
                          options={DOCUMENT_LITERACY_OPTIONS}
                          selected={trackExtras.documentLiteracy}
                          onChange={(v) =>
                            setTrackExtras((prev) => ({ ...prev, documentLiteracy: v }))
                          }
                          placeholder="Khác — VD: Sơ đồ thủy lực…"
                        />
                      </Field>
                      <Field
                        label="20. Cách làm việc kỹ thuật"
                        description={TECHNICAL_WORK_STYLE_QUESTION}
                      >
                        <p className="mb-2 text-xs text-amber-700">
                          {`Tối đa 3 (${filterTechnicalWorkStyles(trackExtras.technicalWorkStyles).length}/3)`}
                        </p>
                        <MultiCheck
                          options={TECHNICAL_WORK_STYLES}
                          selected={filterTechnicalWorkStyles(trackExtras.technicalWorkStyles)}
                          onChange={(v) =>
                            setTrackExtras((prev) => ({
                              ...prev,
                              technicalWorkStyles: filterTechnicalWorkStyles(v),
                            }))
                          }
                          max={3}
                          columns={2}
                        />
                      </Field>
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            21. Định hướng nghề nghiệp
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {TECHNICAL_ORIENTATION_QUESTION}
                          </p>
                        </div>
                        <RadioList
                          name="technicalCareerOrientation"
                          options={TECHNICAL_CAREER_ORIENTATIONS}
                          value={
                            (TECHNICAL_CAREER_ORIENTATIONS as readonly string[]).includes(
                              form.careerOrientations[0] ?? '',
                            )
                              ? (form.careerOrientations[0] ?? '')
                              : form.careerOrientations[0]?.startsWith('Khác')
                                ? 'Khác'
                                : ''
                          }
                          onChange={(v) => {
                            if (v !== 'Khác') {
                              patch('careerOrientations', [v]);
                              return;
                            }
                            const prev = form.careerOrientations[0] ?? '';
                            patch(
                              'careerOrientations',
                              [prev.startsWith('Khác') ? prev : 'Khác'],
                            );
                          }}
                        />
                        {(form.careerOrientations[0] === 'Khác' ||
                          form.careerOrientations[0]?.startsWith('Khác:')) && (
                          <Input
                            value={
                              form.careerOrientations[0]?.startsWith('Khác:')
                                ? form.careerOrientations[0].slice(5).trimStart()
                                : ''
                            }
                            onChange={(e) => {
                              const t = e.target.value;
                              patch(
                                'careerOrientations',
                                [t.trim() ? `Khác: ${t}` : 'Khác'],
                              );
                            }}
                            placeholder="Khác: nhập hướng phát triển…"
                          />
                        )}
                      </div>
                      <div className="space-y-3 border-t border-slate-200 pt-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            22. Động lực khi lựa chọn công việc mới
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {TECHNICAL_MOTIVATION_QUESTION}
                          </p>
                        </div>
                        <p className="text-xs text-amber-700">
                          {`Tối đa 3 (${filterCareerMotivations(form.careerMotivations, 'technical').length}/3)`}
                        </p>
                        <MultiCheck
                          options={TECHNICAL_CAREER_MOTIVATIONS}
                          selected={filterCareerMotivations(form.careerMotivations, 'technical')}
                          onChange={(v) =>
                            patch('careerMotivations', filterCareerMotivations(v, 'technical'))
                          }
                          max={3}
                          columns={2}
                        />
                      </div>
                      <Field
                        label="23. Môi trường làm việc mong muốn"
                        description={WORK_ENVIRONMENT_DESIRED_QUESTION}
                      >
                        <MultiCheck
                          options={WORK_ENVIRONMENT_OPTIONS}
                          selected={trackExtras.desiredWorkEnvironments}
                          onChange={(v) =>
                            setTrackExtras((prev) => ({
                              ...prev,
                              desiredWorkEnvironments: v.slice(0, 3),
                            }))
                          }
                          max={3}
                          columns={2}
                        />
                      </Field>
                    </>
                  )}
                  {isSales && (
                    <>
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            17. Định hướng nghề nghiệp
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {CAREER_ORIENTATION_QUESTION}
                          </p>
                        </div>
                        <RadioList
                          name="careerOrientation"
                          options={CAREER_ORIENTATIONS}
                          value={form.careerOrientations[0] ?? ''}
                          onChange={(v) => patch('careerOrientations', [v])}
                        />
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            18. {CULTURE_FIT_SECTION_TITLE}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">{CULTURE_FIT_SUBTITLE}</p>
                        </div>
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          {CULTURE_FIT_QUESTIONS.map((q, qi) => (
                            <Field key={q.id} label={`${qi + 1}. ${q.question}`}>
                              <div className="grid gap-2">
                                {q.options.map((opt, i) => {
                                  const letter = String.fromCharCode(65 + i);
                                  const checked = form.cultureFit[q.id] === opt;
                                  return (
                                    <label
                                      key={opt}
                                      className={clsx(
                                        'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                                        checked
                                          ? 'border-brand-300 bg-brand-50 text-brand-900'
                                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                      )}
                                    >
                                      <input
                                        type="radio"
                                        name={`cultureFit-${q.id}`}
                                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        checked={checked}
                                        onChange={() => patchCultureFit(q.id, opt)}
                                      />
                                      <span>
                                        <span className="font-semibold">{letter}. </span>
                                        {opt}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </Field>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">
                            19. Động lực khi lựa chọn công việc mới
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {CAREER_MOTIVATION_QUESTION}
                          </p>
                        </div>
                        <p className="text-xs text-amber-700">
                          {`Tối đa 3 (${filterCareerMotivations(form.careerMotivations, 'sales').length}/3)`}
                        </p>
                        <MultiCheck
                          options={CAREER_MOTIVATIONS}
                          selected={filterCareerMotivations(form.careerMotivations, 'sales')}
                          onChange={(v) =>
                            patch('careerMotivations', filterCareerMotivations(v, 'sales'))
                          }
                          max={3}
                          columns={2}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 5 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-accent-600">
                      {isTechnical
                        ? 'D. Kinh nghiệm công ty (24–32)'
                        : 'D. Kinh nghiệm công ty (20–34)'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {isTechnical
                        ? 'Mỗi công ty một mục — công ty thứ 2 trở đi lặp lại các câu 24–32.'
                        : 'Mỗi công ty một mục — công ty thứ 2 trở đi lặp lại các câu 20–34.'}
                    </p>
                  </div>
                  {!trackExtras.jobTrack && <ChooseTrackNote />}
                  {isTechnical && (
                    <>
                      <div className="space-y-6">
                        {form.experiences.map((exp, index) => {
                          const hasMissing = exp.missingFields.length > 0;
                          const highlight = cvEntry && exp.source === 'cv_ai' && hasMissing;
                          return (
                            <div
                              key={exp.id ?? index}
                              className={clsx(
                                'space-y-4 rounded-xl border p-4',
                                highlight
                                  ? 'border-amber-300 bg-amber-50/40'
                                  : 'border-slate-200 bg-slate-50/50',
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Kinh nghiệm công ty {index + 1}
                                    {exp.source === 'cv_ai' && (
                                      <span className="ml-2 inline-flex">
                                        <Badge tone="brand">Từ CV AI</Badge>
                                      </span>
                                    )}
                                  </p>
                                  <MissingBadges fields={exp.missingFields} highlight={highlight} />
                                </div>
                                {form.experiences.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() => removeExperience(index)}
                                  >
                                    Xoá
                                  </Button>
                                )}
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="24. Tên công ty *">
                                  <Input
                                    value={exp.companyName}
                                    onChange={(e) =>
                                      patchExperience(index, { companyName: e.target.value })
                                    }
                                    placeholder="Anh/chị từng làm việc tại công ty nào?"
                                  />
                                </Field>
                                <Field label="25. Vị trí *">
                                  <Input
                                    value={exp.jobTitle}
                                    onChange={(e) =>
                                      patchExperience(index, { jobTitle: e.target.value })
                                    }
                                    placeholder="Anh/chị làm vị trí gì tại công ty này?"
                                  />
                                </Field>
                              </div>
                              <Field label="26. Thời gian làm việc *">
                                <MonthYearRangeFields
                                  start={exp.startYear}
                                  end={exp.endYear}
                                  current={exp.isCurrent}
                                  onStartChange={(v) =>
                                    patchExperience(index, { startYear: v })
                                  }
                                  onEndChange={(v) =>
                                    patchExperience(index, { endYear: v })
                                  }
                                  onCurrentChange={(checked) =>
                                    patchExperience(index, {
                                      isCurrent: checked,
                                      endYear: checked ? '' : exp.endYear,
                                    })
                                  }
                                />
                              </Field>

                              <Field
                                label="27. Lĩnh vực đã làm *"
                                description="Anh/chị làm trong lĩnh vực nào tại công ty này?"
                              >
                                <MultiCheck
                                  options={EXPERIENCE_INDUSTRY_OPTIONS}
                                  selected={exp.industries}
                                  onChange={(v) => patchExperience(index, { industries: v })}
                                  columns={2}
                                />
                              </Field>

                              <Field
                                label="28. Thiết bị / hệ thống đã làm *"
                                description={EQUIPMENT_SYSTEM_QUESTION}
                              >
                                <MultiCheckWithCustom
                                  options={EQUIPMENT_SYSTEM_OPTIONS}
                                  selected={exp.productsSold}
                                  onChange={(v) => patchExperience(index, { productsSold: v })}
                                  placeholder="Khác — nhập thiết bị / hệ thống…"
                                  searchable
                                />
                              </Field>

                              <Field
                                label="29. Môi trường làm việc thực tế *"
                                description={WORK_ENVIRONMENT_ACTUAL_QUESTION}
                              >
                                <MultiCheckWithCustom
                                  options={WORK_ENVIRONMENT_OPTIONS}
                                  selected={exp.customerSegments}
                                  onChange={(v) =>
                                    patchExperience(index, { customerSegments: v })
                                  }
                                  placeholder="Khác — VD: Trạm điện, mỏ…"
                                />
                              </Field>

                              <Field
                                label="30. Công việc kỹ thuật đã thực hiện *"
                                description={TECHNICAL_WORK_TYPES_QUESTION}
                              >
                                <MultiCheck
                                  options={TECHNICAL_WORK_TYPES}
                                  selected={exp.sellingStages}
                                  onChange={(v) => patchExperience(index, { sellingStages: v })}
                                  columns={2}
                                />
                              </Field>

                              <Field
                                label="31. Mức độ tự chủ"
                                description={TECHNICAL_AUTONOMY_QUESTION}
                              >
                                <RadioList
                                  name={`technicalAutonomy-${index}`}
                                  options={TECHNICAL_AUTONOMY_LEVELS.map((lv) => lv.label)}
                                  value={
                                    TECHNICAL_AUTONOMY_LEVELS.find(
                                      (lv) => lv.value === trackExtras.technicalAutonomyLevel,
                                    )?.label ?? ''
                                  }
                                  onChange={(label) => {
                                    const lv = TECHNICAL_AUTONOMY_LEVELS.find(
                                      (o) => o.label === label,
                                    );
                                    setTrackExtras((prev) => ({
                                      ...prev,
                                      technicalAutonomyLevel: lv ? lv.value : null,
                                    }));
                                  }}
                                />
                              </Field>

                              <Field
                                label="32. Thành tích/dự án nổi bật"
                                description={TECHNICAL_HIGHLIGHTS_QUESTION}
                              >
                                <Textarea
                                  rows={3}
                                  value={exp.highlights}
                                  onChange={(e) =>
                                    patchExperience(index, { highlights: e.target.value })
                                  }
                                  placeholder={TECHNICAL_HIGHLIGHTS_PLACEHOLDER}
                                />
                              </Field>
                            </div>
                          );
                        })}
                      </div>
                      <Button type="button" variant="outline" onClick={addExperience}>
                        + Thêm công ty (lặp lại mục 24–32)
                      </Button>
                    </>
                  )}
                  {isSales && (
                    <>
                      <div className="space-y-6">
                        {form.experiences.map((exp, index) => {
                          const hasMissing = exp.missingFields.length > 0;
                          const highlight = cvEntry && exp.source === 'cv_ai' && hasMissing;
                          const dealTypesSelected = splitDealTypes(exp.dealType).map(
                            (v) => DEAL_TYPE_LABEL[v],
                          );
                          return (
                            <div
                              key={exp.id ?? index}
                              className={clsx(
                                'space-y-4 rounded-xl border p-4',
                                highlight
                                  ? 'border-amber-300 bg-amber-50/40'
                                  : 'border-slate-200 bg-slate-50/50',
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Kinh nghiệm công ty {index + 1}
                                    {exp.source === 'cv_ai' && (
                                      <span className="ml-2 inline-flex">
                                        <Badge tone="brand">Từ CV AI</Badge>
                                      </span>
                                    )}
                                  </p>
                                  <MissingBadges fields={exp.missingFields} highlight={highlight} />
                                </div>
                                {form.experiences.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() => removeExperience(index)}
                                  >
                                    Xoá
                                  </Button>
                                )}
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="20. Tên công ty *">
                                  <Input
                                    value={exp.companyName}
                                    onChange={(e) =>
                                      patchExperience(index, { companyName: e.target.value })
                                    }
                                    placeholder="Anh/chị từng làm việc tại công ty nào?"
                                  />
                                </Field>
                                <Field label="21. Vị trí *">
                                  <Input
                                    value={exp.jobTitle}
                                    onChange={(e) =>
                                      patchExperience(index, { jobTitle: e.target.value })
                                    }
                                    placeholder="Anh/chị làm vị trí gì tại công ty này?"
                                  />
                                </Field>
                              </div>
                              <Field label="22. Thời gian làm việc *">
                                <MonthYearRangeFields
                                  start={exp.startYear}
                                  end={exp.endYear}
                                  current={exp.isCurrent}
                                  onStartChange={(v) =>
                                    patchExperience(index, { startYear: v })
                                  }
                                  onEndChange={(v) =>
                                    patchExperience(index, { endYear: v })
                                  }
                                  onCurrentChange={(checked) =>
                                    patchExperience(index, {
                                      isCurrent: checked,
                                      endYear: checked ? '' : exp.endYear,
                                    })
                                  }
                                />
                              </Field>

                              <Field
                                label="23. Ngành / lĩnh vực *"
                                description="Anh/chị làm trong lĩnh vực nào tại công ty này?"
                              >
                                <MultiCheck
                                  options={EXPERIENCE_INDUSTRY_OPTIONS}
                                  selected={exp.industries}
                                  onChange={(v) => patchExperience(index, { industries: v })}
                                  columns={2}
                                />
                              </Field>

                              <Field
                                label="24. Sản phẩm / thiết bị đã bán *"
                                description={PRODUCTS_SOLD_QUESTION}
                              >
                                <BrandTechnologySearch
                                  selected={exp.productsSold}
                                  onChange={(v) => patchExperience(index, { productsSold: v })}
                                  suggest={suggestProducts}
                                  placeholder="Tìm thiết bị công nghiệp (máy nén khí, PLC, HVAC…)"
                                  hint="Gõ để gợi ý sản phẩm/thiết bị. Không có trong danh sách — bấm “+ Thêm” để nhập tay."
                                  emptyMessage="Gõ tên thiết bị để tìm trong danh mục"
                                />
                              </Field>

                              <Field label="25. Nhóm khách hàng đã bán *">
                                <MultiCheck
                                  options={CUSTOMER_SEGMENTS}
                                  selected={exp.customerSegments}
                                  onChange={(v) =>
                                    patchExperience(index, { customerSegments: v })
                                  }
                                  columns={2}
                                />
                              </Field>

                              <Field label="26. Giải pháp sản phẩm *">
                                <MultiCheck
                                  options={DEAL_TYPE_CHECK_OPTIONS.map((o) => o.label)}
                                  selected={dealTypesSelected}
                                  onChange={(labels) => {
                                    const values = labels
                                      .map(
                                        (l) =>
                                          DEAL_TYPE_CHECK_OPTIONS.find((o) => o.label === l)
                                            ?.value,
                                      )
                                      .filter((v): v is string => Boolean(v));
                                    patchExperience(index, {
                                      dealType: joinDealTypes(values) ?? '',
                                    });
                                  }}
                                  columns={2}
                                />
                              </Field>

                              <Field
                                label="27. Phạm vi công việc bán hàng đã phụ trách"
                                description={SELLING_STAGES_QUESTION}
                              >
                                <div className="mb-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      patchExperience(index, {
                                        sellingStages:
                                          exp.sellingStages.length === SELLING_STAGES.length
                                            ? []
                                            : [...SELLING_STAGES],
                                      })
                                    }
                                  >
                                    {exp.sellingStages.length === SELLING_STAGES.length
                                      ? 'Bỏ chọn tất cả'
                                      : 'Chọn tất cả'}
                                  </Button>
                                </div>
                                <MultiCheck
                                  options={SELLING_STAGES}
                                  selected={exp.sellingStages}
                                  onChange={(v) => patchExperience(index, { sellingStages: v })}
                                  columns={2}
                                />
                                <label className="mt-3 block">
                                  <span className="text-sm font-semibold text-slate-800">
                                    Mô tả/phạm vi công việc thực tế
                                  </span>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Viết thêm nếu checkbox chưa đủ mô tả công việc anh/chị đã phụ trách.
                                  </p>
                                  <Textarea
                                    rows={3}
                                    value={exp.jobDescription}
                                    onChange={(e) =>
                                      patchExperience(index, { jobDescription: e.target.value })
                                    }
                                    placeholder="VD: Phụ trách bán thiết bị khí nén khu vực miền Nam, từ tìm khách đến chốt đơn và bàn giao kỹ thuật."
                                    className="mt-1.5"
                                  />
                                </label>
                              </Field>

                              <details className="rounded-lg border border-slate-200 bg-white">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                                  28–34. Nhóm khuyến khích — giúp AI kết nối với NTD dễ hơn
                                </summary>
                                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                                  <Field
                                    label="28. Hãng / thương hiệu sản phẩm"
                                    description="Anh/chị từng làm sản phẩm/thiết bị hãng nào?"
                                  >
                                    <BrandTechnologySearch
                                      selected={exp.brandsTechnologies ?? []}
                                      onChange={(next) =>
                                        patchExperience(index, { brandsTechnologies: next })
                                      }
                                    />
                                  </Field>
                                  <Field label="29. Khu vực / thị trường phụ trách">
                                    <MultiCheck
                                      options={MARKET_REGIONS}
                                      selected={exp.marketsCovered}
                                      onChange={(v) =>
                                        patchExperience(index, { marketsCovered: v })
                                      }
                                      columns={3}
                                    />
                                  </Field>
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label={`30. ${PERSONAL_REVENUE_QUESTION}`}>
                                      <MoneyInput
                                        value={exp.latestRevenue}
                                        onChange={(v) =>
                                          patchExperience(index, { latestRevenue: v })
                                        }
                                        placeholder="Ví dụ: 12 tỷ/năm"
                                        hint={moneyHint(exp.latestRevenue)}
                                      />
                                    </Field>
                                    <Field label="31. Mức độ hoàn thành KPI">
                                      <Select
                                        value={exp.kpiBand}
                                        onChange={(e) =>
                                          patchExperience(index, { kpiBand: e.target.value })
                                        }
                                      >
                                        <option value="">— Chọn —</option>
                                        {KPI_ACHIEVEMENT_BANDS.map((b) => (
                                          <option key={b.value} value={b.value}>
                                            {b.label}
                                          </option>
                                        ))}
                                      </Select>
                                    </Field>
                                    <Field label="32. Tỷ lệ khách hàng tự tìm kiếm">
                                      <Select
                                        value={exp.newCustomerRatioBand}
                                        onChange={(e) =>
                                          patchExperience(index, {
                                            newCustomerRatioBand: e.target.value,
                                          })
                                        }
                                      >
                                        <option value="">— Chọn —</option>
                                        {NEW_CUSTOMER_RATIO_BANDS.map((b) => (
                                          <option key={b.value} value={b.value}>
                                            {b.label}
                                          </option>
                                        ))}
                                      </Select>
                                    </Field>
                                    <Field label="33. Giá trị hợp đồng thường gặp">
                                      <Select
                                        value={exp.typicalDealValueBand}
                                        onChange={(e) =>
                                          patchExperience(index, {
                                            typicalDealValueBand: e.target.value,
                                          })
                                        }
                                      >
                                        <option value="">— Chọn —</option>
                                        {DEAL_VALUE_BANDS.map((b) => (
                                          <option key={b.value} value={b.value}>
                                            {b.label}
                                          </option>
                                        ))}
                                      </Select>
                                    </Field>
                                  </div>
                                  <Field label="34. Thành tích kinh doanh nổi bật tại công ty này?">
                                    <Textarea
                                      rows={3}
                                      value={exp.highlights}
                                      onChange={(e) =>
                                        patchExperience(index, { highlights: e.target.value })
                                      }
                                      placeholder={SALES_HIGHLIGHTS_PLACEHOLDER}
                                    />
                                  </Field>
                                </div>
                              </details>
                            </div>
                          );
                        })}
                      </div>

                      <Button type="button" variant="outline" onClick={addExperience}>
                        + Thêm công ty (lặp lại mục 20–34)
                      </Button>
                    </>
                  )}
                </>
              )}

              {step === 6 && (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">Xem lại & lưu</h2>
                  <p className="text-sm text-slate-500">
                    Kiểm tra lại trước khi lưu. Bạn có thể quay lại bất kỳ bước nào để chỉnh sửa.
                  </p>

                  <dl className="space-y-4 divide-y divide-slate-100">
                    <div className="space-y-2 pt-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                        A. Thông tin cơ bản (1–12)
                      </p>
                      <ReviewRow label="Họ tên" value={form.displayName} />
                      <ReviewRow label="Năm sinh" value={form.birthYear} />
                      <ReviewRow label="Điện thoại" value={form.phone} />
                      <ReviewRow label="Email" value={me?.email ?? ''} />
                      <ReviewRow
                        label="Nơi sinh sống"
                        value={[form.ward, form.currentCity].filter(Boolean).join(', ')}
                      />
                      <ReviewRow label="Trình độ" value={form.educationLevel} />
                      <ReviewRow label="Trường" value={form.educationSchool} />
                      <ReviewRow label="Chuyên ngành" value={form.educationMajor} />
                      <ReviewRow label="Chứng chỉ" value={form.certificates} />
                      <ReviewRow
                        label="Ngoại ngữ"
                        value={
                          form.languageSkills.length > 0
                            ? form.languageSkills.map(formatLanguageSkillSummary).join('; ')
                            : form.languages.length > 0
                              ? form.languages.join(', ')
                              : '—'
                        }
                      />
                      <ReviewRow
                        label="Giấy phép lái xe"
                        value={form.driverLicenses.join(', ')}
                      />
                      <ReviewRow
                        label="Đi công tác"
                        value={
                          form.travelAbility
                            ? TRAVEL_ABILITY_LABEL[form.travelAbility as TravelAbility]
                            : '—'
                        }
                      />
                    </div>

                    <div className="space-y-2 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Hướng hồ sơ
                      </p>
                      <ReviewRow
                        label="Lĩnh vực"
                        value={
                          trackExtras.jobTrack
                            ? JOB_TRACK_LABEL[trackExtras.jobTrack]
                            : 'Chưa chọn'
                        }
                      />
                    </div>

                    {isSales && (
                      <>
                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            B. Mong muốn nghề nghiệp (13–16)
                          </p>
                          <ReviewRow
                            label="Vị trí ứng tuyển"
                            value={
                              form.desiredPositions.length > 0
                                ? form.desiredPositions.join(', ')
                                : '—'
                            }
                          />
                          <ReviewRow
                            label="Địa điểm"
                            value={
                              form.desiredLocations.length > 0
                                ? form.desiredLocations.join(', ')
                                : '—'
                            }
                          />
                          <ReviewRow
                            label="Thu nhập tối thiểu"
                            value={formatVnd(form.expectedSalaryMin)}
                          />
                          <ReviewRow label="Thu nhập kỳ vọng" value={formatVnd(form.expectedOte)} />
                          <ReviewRow
                            label="Nhận việc"
                            value={
                              form.availabilityBand
                                ? AVAILABILITY_BAND_LABEL[
                                    form.availabilityBand as AvailabilityBand
                                  ]
                                : '—'
                            }
                          />
                        </div>

                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            C. Định hướng & phù hợp (17–19)
                          </p>
                          <ReviewRow
                            label="Định hướng"
                            value={form.careerOrientations[0] ?? '—'}
                          />
                          {CULTURE_FIT_QUESTIONS.map((q) => (
                            <ReviewRow
                              key={q.id}
                              label={q.question}
                              value={form.cultureFit[q.id] || '—'}
                            />
                          ))}
                          <ReviewRow
                            label="Động lực"
                            value={
                              form.careerMotivations.length > 0
                                ? form.careerMotivations.join(', ')
                                : '—'
                            }
                          />
                        </div>

                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            D. Kinh nghiệm công ty ({filledExperiences.length})
                          </p>
                          {filledExperiences.length === 0 ? (
                            <p className="text-sm text-slate-500">Chưa có kinh nghiệm công ty.</p>
                          ) : (
                            filledExperiences.map((exp, i) => (
                              <div
                                key={i}
                                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {exp.jobTitle || '—'} · {exp.companyName || '—'}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {formatMonthYearLabel(exp.startYear)} –{' '}
                                  {exp.isCurrent ? 'Hiện tại' : formatMonthYearLabel(exp.endYear)}
                                </p>
                                {exp.missingFields.length > 0 && (
                                  <div className="mt-2">
                                    <MissingBadges fields={exp.missingFields} highlight />
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                          {trackExtras.brandsTechnologies.length > 0 && (
                            <ReviewRow
                              label="Hãng/thương hiệu"
                              value={trackExtras.brandsTechnologies.join(', ')}
                            />
                          )}
                        </div>
                      </>
                    )}

                    {isTechnical && (
                      <>
                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            B. Mong muốn nghề nghiệp (13–16)
                          </p>
                          <ReviewRow
                            label="Vị trí ứng tuyển"
                            value={
                              form.desiredPositions.length > 0
                                ? form.desiredPositions.join(', ')
                                : '—'
                            }
                          />
                          <ReviewRow
                            label="Địa điểm"
                            value={
                              form.desiredLocations.length > 0
                                ? form.desiredLocations.join(', ')
                                : '—'
                            }
                          />
                          <ReviewRow
                            label="Thu nhập tối thiểu"
                            value={formatVnd(form.expectedSalaryMin)}
                          />
                          <ReviewRow label="Thu nhập kỳ vọng" value={formatVnd(form.expectedOte)} />
                          <ReviewRow
                            label="Nhận việc"
                            value={
                              form.availabilityBand
                                ? AVAILABILITY_BAND_LABEL[
                                    form.availabilityBand as AvailabilityBand
                                  ]
                                : '—'
                            }
                          />
                        </div>
                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            C. Năng lực và định hướng (17–23)
                          </p>
                          <ReviewRow
                            label="Làm ngoài giờ"
                            value={
                              SHIFT_FLEXIBILITY_OPTIONS.find(
                                (o) => o.value === trackExtras.shiftFlexibility,
                              )?.label ?? '—'
                            }
                          />
                          <ReviewRow
                            label="Phần mềm / công cụ"
                            value={trackExtras.technicalTools.join(', ')}
                          />
                          <ReviewRow
                            label="Đọc bản vẽ / tài liệu"
                            value={trackExtras.documentLiteracy.join(', ')}
                          />
                          <ReviewRow
                            label="Cách làm việc"
                            value={trackExtras.technicalWorkStyles.join(', ')}
                          />
                          <ReviewRow
                            label="Định hướng"
                            value={form.careerOrientations.join(', ')}
                          />
                          <ReviewRow
                            label="Động lực"
                            value={form.careerMotivations.join(', ')}
                          />
                          <ReviewRow
                            label="Môi trường mong muốn"
                            value={trackExtras.desiredWorkEnvironments.join(', ')}
                          />
                        </div>
                        <div className="space-y-2 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                            D. Kinh nghiệm (24–32)
                          </p>
                          {filledExperiences.length === 0 ? (
                            <p className="text-sm text-slate-500">Chưa có kinh nghiệm</p>
                          ) : (
                            filledExperiences.map((exp, i) => (
                              <div key={exp.id ?? i} className="rounded-lg bg-slate-50 px-3 py-2">
                                <p className="text-sm font-semibold text-slate-800">
                                  {exp.jobTitle || 'Vị trí'} · {exp.companyName || 'Công ty'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {[exp.startYear, exp.isCurrent ? 'Hiện tại' : exp.endYear]
                                    .filter(Boolean)
                                    .join(' – ')}
                                </p>
                                {exp.productsSold.length > 0 && (
                                  <p className="mt-1 text-xs text-slate-600">
                                    Thiết bị: {exp.productsSold.join(', ')}
                                  </p>
                                )}
                                {exp.sellingStages.length > 0 && (
                                  <p className="text-xs text-slate-600">
                                    Công việc: {exp.sellingStages.join(', ')}
                                  </p>
                                )}
                                {exp.highlights.trim() ? (
                                  <p className="mt-1 text-xs text-slate-600">
                                    Thành tích/dự án: {exp.highlights.trim()}
                                  </p>
                                ) : null}
                                {exp.jobDescription.trim() ? (
                                  <p className="mt-1 text-xs text-slate-600">
                                    {exp.jobDescription.trim()}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          )}
                          <ReviewRow
                            label="Mức tự chủ"
                            value={
                              TECHNICAL_AUTONOMY_LEVELS.find(
                                (lv) => lv.value === trackExtras.technicalAutonomyLevel,
                              )?.label ?? '—'
                            }
                          />
                        </div>
                      </>
                    )}
                  </dl>
                </>
              )}

              {saveMutation.isError && (
                <p className="text-sm text-red-600">
                  {saveMutation.error instanceof ApiError
                    ? saveMutation.error.message
                    : 'Không lưu được hồ sơ'}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div>
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={goBack}>
                      <ChevronLeft className="h-4 w-4" />
                      Quay lại
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">
                    Bước {step}/{STEPS.length}
                  </span>
                  {step < 6 ? (
                    <Button type="button" onClick={goNext} disabled={!stepValid}>
                      Tiếp theo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={saveMutation.isPending || !form.displayName.trim()}
                      onClick={() => saveMutation.mutate()}
                    >
                      {saveMutation.isPending ? 'Đang lưu...' : 'Lưu hồ sơ'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
