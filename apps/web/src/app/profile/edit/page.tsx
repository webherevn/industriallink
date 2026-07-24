'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  AvailabilityBand,
  DEAL_TYPE_LABEL,
  DEAL_VALUE_BANDS,
  DESIRED_POSITIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  JOB_READINESS_LABEL,
  JobReadiness,
  KPI_ACHIEVEMENT_BANDS,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  NEW_CUSTOMER_RATIO_BANDS,
  PRODUCTS_SOLD,
  CUSTOMER_SEGMENTS,
  PROFILE_MISSING_FIELD_LABEL,
  SELLING_STAGES,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  dealValueBandToVnd,
  kpiBandToPct,
  newCustomerBandToPct,
  type ProfileMissingFieldKey,
  type UpdateCandidateProfileRequest,
  availabilityToNoticeDays,
  noticeDaysToAvailability,
  SkillLevel,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getMyCandidate, updateMyProfile } from '@/lib/candidate';

const STEPS = [
  { id: 1, label: 'Cơ bản' },
  { id: 2, label: 'Mong muốn' },
  { id: 3, label: 'Kinh nghiệm' },
  { id: 4, label: 'Điều kiện' },
  { id: 5, label: 'Kỹ năng' },
  { id: 6, label: 'Xem lại' },
] as const;

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
  missingFields: string[];
  source: string;
};

type SkillRow = { name: string; level: string };

type FormState = {
  displayName: string;
  phone: string;
  birthYear: string;
  currentCity: string;
  desiredPositions: string[];
  desiredLocations: string[];
  expectedSalaryMin: string;
  expectedOte: string;
  availabilityBand: string;
  jobReadiness: string;
  experiences: ExperienceRow[];
  languages: string[];
  hasB2License: '' | 'true' | 'false';
  driverLicenseType: string;
  travelAbility: string;
  educationLevel: string;
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
  customerDevStyle: string;
  dealType: string;
  latestRevenue: string;
  kpiAchievementPct: string;
  newCustomerRatioPct: string;
  typicalDealValue: string;
  maxDealValue: string;
  expectedSalaryMax: string;
  willingToTravel: '' | 'true' | 'false';
  careerMotivations: string[];
  workStyles: string[];
  careerOrientation: string;
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
    missingFields: [],
    source: 'manual',
  };
}

const EMPTY_FORM: FormState = {
  displayName: '',
  phone: '',
  birthYear: '',
  currentCity: '',
  desiredPositions: [],
  desiredLocations: [],
  expectedSalaryMin: '',
  expectedOte: '',
  availabilityBand: '',
  jobReadiness: '',
  experiences: [emptyExperience()],
  languages: [],
  hasB2License: '',
  driverLicenseType: '',
  travelAbility: '',
  educationLevel: '',
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
  customerDevStyle: '',
  dealType: '',
  latestRevenue: '',
  kpiAchievementPct: '',
  newCustomerRatioPct: '',
  typicalDealValue: '',
  maxDealValue: '',
  expectedSalaryMax: '',
  willingToTravel: '',
  careerMotivations: [],
  workStyles: [],
  careerOrientation: '',
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

function parseOptionalBool(value: '' | 'true' | 'false'): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function boolToSelect(value: boolean | null | undefined): '' | 'true' | 'false' {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
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
  missingFields: ProfileMissingFieldKey[] | string[];
  source: string;
}): ExperienceRow {
  return {
    id: exp.id,
    companyName: exp.companyName ?? '',
    jobTitle: exp.jobTitle ?? '',
    startYear: exp.startYear != null ? String(exp.startYear) : '',
    endYear: exp.endYear != null ? String(exp.endYear) : '',
    isCurrent: exp.isCurrent,
    industries: [...(exp.industries ?? [])],
    productsSold: [...(exp.productsSold ?? [])],
    customerSegments: [...(exp.customerSegments ?? [])],
    marketsCovered: [...(exp.marketsCovered ?? [])],
    sellingStages: [...(exp.sellingStages ?? [])],
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
    highlights: exp.highlights ?? '',
    missingFields: [...(exp.missingFields ?? [])],
    source: exp.source ?? 'manual',
  };
}

function toPayload(form: FormState): UpdateCandidateProfileRequest {
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
        startYear: parseOptionalInt(e.startYear),
        endYear: e.isCurrent ? null : parseOptionalInt(e.endYear),
        isCurrent: e.isCurrent,
        industries: e.industries,
        productsSold: e.productsSold,
        customerSegments: e.customerSegments,
        marketsCovered: e.marketsCovered,
        sellingStages: e.sellingStages,
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
        jobDescription: null,
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

  return {
    displayName: form.displayName.replace(/\r/g, '').trim(),
    phone: form.phone.trim() || null,
    birthYear: parseOptionalInt(form.birthYear),
    currentCity: form.currentCity.trim() || null,
    currentPosition:
      form.currentPosition.trim() || firstExp?.jobTitle || null,
    jobLevel: form.jobLevel.trim() || null,
    totalExperienceYears: parseOptionalNumber(form.totalExperienceYears),
    industry: form.industry.trim() || firstExp?.industries[0] || null,
    industriesExperienced,
    specialization: form.specialization.trim() || null,
    summary: form.summary.trim() || null,
    careerObjective: form.careerObjective.trim() || null,
    productsSold,
    customerSegments,
    b2bExperienceBand: form.b2bExperienceBand || null,
    marketsCovered,
    salesHighlights: form.salesHighlights.trim() || null,
    customerDevStyle: form.customerDevStyle || null,
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
    languages: form.languages,
    hasB2License: parseOptionalBool(form.hasB2License),
    driverLicenseType: form.driverLicenseType || null,
    willingToTravel: parseOptionalBool(form.willingToTravel),
    travelAbility: form.travelAbility || null,
    desiredPositions: form.desiredPositions,
    desiredLocations: form.desiredLocations,
    careerMotivations: form.careerMotivations,
    workStyles: form.workStyles,
    careerOrientation: form.careerOrientation || null,
    educationLevel: form.educationLevel || null,
    educationSchool: form.educationSchool.trim() || null,
    educationMajor: form.educationMajor.trim() || null,
    certificates: splitCsv(form.certificates),
    skills: form.skills
      .map((s) => ({ name: s.name.replace(/\r/g, '').trim(), level: s.level || SkillLevel.Intermediate }))
      .filter((s) => s.name.length > 0),
    experiences,
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
              className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
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

export default function ProfileEditPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: candidate, isLoading, isError, error } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
  });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
    const hasCvAi = candidate.experiences.some((e) => e.source === 'cv_ai');

    setForm({
      displayName: candidate.displayName ?? '',
      phone: p?.phone ?? '',
      birthYear: p?.birthYear != null ? String(p.birthYear) : '',
      currentCity: p?.currentCity ?? '',
      desiredPositions: [...(sales?.desiredPositions ?? [])],
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
      hasB2License: boolToSelect(sales?.hasB2License),
      driverLicenseType: sales?.driverLicenseType ?? '',
      travelAbility: sales?.travelAbility ?? '',
      educationLevel: p?.educationLevel ?? '',
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
      customerDevStyle: sales?.customerDevStyle ?? '',
      dealType: sales?.dealType ?? '',
      latestRevenue: sales?.latestRevenue != null ? String(sales.latestRevenue) : '',
      kpiAchievementPct:
        sales?.kpiAchievementPct != null ? String(sales.kpiAchievementPct) : '',
      newCustomerRatioPct:
        sales?.newCustomerRatioPct != null ? String(sales.newCustomerRatioPct) : '',
      typicalDealValue: sales?.typicalDealValue != null ? String(sales.typicalDealValue) : '',
      maxDealValue: sales?.maxDealValue != null ? String(sales.maxDealValue) : '',
      expectedSalaryMax: sales?.expectedSalaryMax != null ? String(sales.expectedSalaryMax) : '',
      willingToTravel: boolToSelect(sales?.willingToTravel),
      careerMotivations: [...(sales?.careerMotivations ?? [])],
      workStyles: [...(sales?.workStyles ?? [])],
      careerOrientation: sales?.careerOrientation ?? '',
      skills:
        candidate.skills.length > 0
          ? candidate.skills.map((s) => ({ name: s.name, level: s.level }))
          : [],
    });

    if (hasCvAi) {
      setStep(3);
      setCvEntry(true);
    }
    setHydrated(true);
  }, [candidate, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () => updateMyProfile(toPayload(form)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['my-candidate'] });
      router.push('/dashboard');
    },
  });

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  function patchSkill(index: number, patchSkill: Partial<SkillRow>) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === index ? { ...s, ...patchSkill } : s)),
    }));
  }

  function addSkill() {
    setForm((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: '', level: SkillLevel.Intermediate }],
    }));
  }

  function removeSkill(index: number) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.length <= 1 ? prev.skills : prev.skills.filter((_, i) => i !== index),
    }));
  }

  const stepValid = useMemo(() => {
    if (step === 1) return form.displayName.trim().length > 0 && form.currentCity.trim().length > 0;
    if (step === 3) {
      return form.experiences.every((e) => {
        if (!e.companyName.trim() && !e.jobTitle.trim()) return true;
        return e.companyName.trim().length > 0 && e.jobTitle.trim().length > 0;
      });
    }
    return true;
  }, [step, form]);

  const filledExperiences = form.experiences.filter(
    (e) => e.companyName.trim() || e.jobTitle.trim(),
  );

  function goNext() {
    if (!stepValid || step >= 6) return;
    setStep(step + 1);
  }

  function goBack() {
    if (step <= 1) return;
    setStep(step - 1);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Hồ sơ Sales B2B
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Hoàn thiện hồ sơ</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ma trận hồ sơ IndustrialLink — từng bước, không cần điền hết một lần.
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
            <nav className="overflow-x-auto">
              <ol className="flex min-w-max items-center gap-1 sm:gap-2">
                {STEPS.map((s, idx) => {
                  const active = step === s.id;
                  const done = step > s.id;
                  return (
                    <li key={s.id} className="flex items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(s.id)}
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

            {cvEntry && step === 3 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                AI đã trích xuất kinh nghiệm từ CV. Vui lòng kiểm tra và bổ sung các mục được
                đánh dấu <Badge tone="amber">Thiếu</Badge> bên dưới.
              </div>
            )}

            <Card className="space-y-5">
              {step === 1 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Thông tin cơ bản</h2>
                    <Link href="/upload">
                      <Button type="button" variant="outline" className="text-brand-700">
                        Có CV? Tải để AI điền
                      </Button>
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Họ và tên *">
                      <Input
                        value={form.displayName}
                        onChange={(e) => patch('displayName', e.target.value)}
                        maxLength={200}
                        required
                      />
                    </Field>
                    <Field label="Số điện thoại">
                      <Input
                        value={form.phone}
                        onChange={(e) => patch('phone', e.target.value)}
                        placeholder="090x xxx xxx"
                      />
                    </Field>
                    <Field label="Năm sinh">
                      <Input
                        type="number"
                        min={1950}
                        max={2015}
                        value={form.birthYear}
                        onChange={(e) => patch('birthYear', e.target.value)}
                        placeholder="VD: 1995"
                      />
                    </Field>
                    <Field label="Thành phố hiện tại *">
                      <Input
                        value={form.currentCity}
                        onChange={(e) => patch('currentCity', e.target.value)}
                        placeholder="VD: TP.HCM, Hà Nội..."
                        required
                      />
                    </Field>
                  </div>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Ảnh đại diện: tải tại trang{' '}
                    <Link href="/account" className="font-medium text-brand-600 hover:underline">
                      Tài khoản
                    </Link>{' '}
                    — hiển thị trên hồ sơ NTD.
                  </p>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">Mong muốn nghề nghiệp</h2>
                  <Field label="Vị trí mong muốn (tối đa 3)">
                    <MultiCheck
                      options={DESIRED_POSITIONS}
                      selected={form.desiredPositions}
                      onChange={(v) => patch('desiredPositions', v)}
                      max={3}
                      columns={2}
                    />
                  </Field>
                  <Field label="Địa điểm làm việc mong muốn">
                    <MultiCheck
                      options={MARKET_REGIONS}
                      selected={form.desiredLocations}
                      onChange={(v) => patch('desiredLocations', v)}
                      columns={2}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Lương cơ bản tối thiểu (VND/tháng)">
                      <Input
                        type="number"
                        min={0}
                        value={form.expectedSalaryMin}
                        onChange={(e) => patch('expectedSalaryMin', e.target.value)}
                        placeholder="VD: 15000000"
                      />
                    </Field>
                    <Field label="Tổng thu nhập kỳ vọng — OTE (VND/tháng)">
                      <Input
                        type="number"
                        min={0}
                        value={form.expectedOte}
                        onChange={(e) => patch('expectedOte', e.target.value)}
                        placeholder="Base + hoa hồng + thưởng"
                      />
                    </Field>
                    <Field label="Thời gian có thể nhận việc">
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
                    <Field label="Trạng thái tìm việc">
                      <Select
                        value={form.jobReadiness}
                        onChange={(e) => patch('jobReadiness', e.target.value)}
                      >
                        <option value="">— Chọn —</option>
                        {Object.values(JobReadiness).map((v) => (
                          <option key={v} value={v}>
                            {JOB_READINESS_LABEL[v]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Kinh nghiệm công ty</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Mỗi công ty một mục — điền theo ma trận Sales B2B IndustrialLink.
                    </p>
                  </div>

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
                                Kinh nghiệm {index + 1}
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
                            <Field label="Tên công ty *">
                              <Input
                                value={exp.companyName}
                                onChange={(e) =>
                                  patchExperience(index, { companyName: e.target.value })
                                }
                                placeholder="VD: Công ty ABC"
                              />
                            </Field>
                            <Field label="Chức danh *">
                              <Input
                                value={exp.jobTitle}
                                onChange={(e) =>
                                  patchExperience(index, { jobTitle: e.target.value })
                                }
                                placeholder="VD: Sales Engineer"
                              />
                            </Field>
                            <Field label="Năm bắt đầu">
                              <Input
                                type="number"
                                min={1980}
                                max={2030}
                                value={exp.startYear}
                                onChange={(e) =>
                                  patchExperience(index, { startYear: e.target.value })
                                }
                              />
                            </Field>
                            <Field label="Năm kết thúc">
                              <Input
                                type="number"
                                min={1980}
                                max={2030}
                                value={exp.endYear}
                                disabled={exp.isCurrent}
                                onChange={(e) =>
                                  patchExperience(index, { endYear: e.target.value })
                                }
                              />
                            </Field>
                          </div>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-brand-600"
                              checked={exp.isCurrent}
                              onChange={(e) =>
                                patchExperience(index, {
                                  isCurrent: e.target.checked,
                                  endYear: e.target.checked ? '' : exp.endYear,
                                })
                              }
                            />
                            Đang làm việc tại đây
                          </label>

                          <Field label="Sản phẩm / giải pháp đã bán">
                            <MultiCheck
                              options={PRODUCTS_SOLD}
                              selected={exp.productsSold}
                              onChange={(v) => patchExperience(index, { productsSold: v })}
                              columns={2}
                            />
                          </Field>
                          <Field label="Tệp khách hàng">
                            <MultiCheck
                              options={CUSTOMER_SEGMENTS}
                              selected={exp.customerSegments}
                              onChange={(v) => patchExperience(index, { customerSegments: v })}
                              columns={2}
                            />
                          </Field>
                          <Field label="Khu vực / thị trường phụ trách">
                            <MultiCheck
                              options={MARKET_REGIONS}
                              selected={exp.marketsCovered}
                              onChange={(v) => patchExperience(index, { marketsCovered: v })}
                              columns={2}
                            />
                          </Field>
                          <Field label="Giai đoạn bán hàng đã thực hiện (13 giai đoạn)">
                            <MultiCheck
                              options={SELLING_STAGES}
                              selected={exp.sellingStages}
                              onChange={(v) => patchExperience(index, { sellingStages: v })}
                              columns={2}
                            />
                          </Field>

                          <details className="rounded-lg border border-slate-200 bg-white">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                              Thành tích & quy mô thương vụ (khuyến khích bổ sung)
                            </summary>
                            <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Doanh số gần nhất (VND)">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={exp.latestRevenue}
                                    onChange={(e) =>
                                      patchExperience(index, { latestRevenue: e.target.value })
                                    }
                                  />
                                </Field>
                                <Field label="% hoàn thành KPI">
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
                                <Field label="Tỷ lệ khách tự phát triển">
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
                                <Field label="Loại thương vụ">
                                  <Select
                                    value={exp.dealType}
                                    onChange={(e) =>
                                      patchExperience(index, { dealType: e.target.value })
                                    }
                                  >
                                    <option value="">— Chọn —</option>
                                    {Object.entries(DEAL_TYPE_LABEL).map(([v, label]) => (
                                      <option key={v} value={v}>
                                        {label}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field label="Quy mô thương vụ điển hình">
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
                                <Field label="Thương vụ lớn nhất (VND)">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={exp.maxDealValue}
                                    onChange={(e) =>
                                      patchExperience(index, { maxDealValue: e.target.value })
                                    }
                                  />
                                </Field>
                              </div>
                              <Field label="Thành tích nổi bật">
                                <Textarea
                                  rows={3}
                                  value={exp.highlights}
                                  onChange={(e) =>
                                    patchExperience(index, { highlights: e.target.value })
                                  }
                                  placeholder="VD: Top sales 2024, mở 15 KH mới..."
                                />
                              </Field>
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>

                  <Button type="button" variant="outline" onClick={addExperience}>
                    + Thêm kinh nghiệm
                  </Button>
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">Điều kiện công việc</h2>
                  <Field label="Ngoại ngữ">
                    <MultiCheck
                      options={LANGUAGE_OPTIONS}
                      selected={form.languages}
                      onChange={(v) => patch('languages', v)}
                      columns={2}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Bằng lái ô tô">
                      <Select
                        value={form.hasB2License}
                        onChange={(e) =>
                          patch('hasB2License', e.target.value as FormState['hasB2License'])
                        }
                      >
                        <option value="">— Chưa rõ —</option>
                        <option value="true">Có</option>
                        <option value="false">Không</option>
                      </Select>
                    </Field>
                    <Field label="Hạng bằng lái">
                      <Select
                        value={form.driverLicenseType}
                        onChange={(e) => patch('driverLicenseType', e.target.value)}
                        disabled={form.hasB2License !== 'true'}
                      >
                        <option value="">— Chọn —</option>
                        {DRIVER_LICENSE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Khả năng đi công tác">
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
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Kỹ năng & học vấn</h2>
                    <p className="text-sm text-slate-500">
                      Thêm kỹ năng chuyên môn. Học vấn / chứng chỉ là tuỳ chọn.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">Kỹ năng</p>
                      <Button type="button" variant="outline" onClick={addSkill}>
                        Thêm kỹ năng
                      </Button>
                    </div>
                    {form.skills.map((skill, index) => (
                      <div key={index} className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[12rem] flex-1">
                          <Field label={index === 0 ? 'Tên kỹ năng' : ''}>
                            <Input
                              value={skill.name}
                              onChange={(e) => patchSkill(index, { name: e.target.value })}
                              placeholder="VD: Đàm phán B2B"
                            />
                          </Field>
                        </div>
                        <div className="w-40">
                          <Field label={index === 0 ? 'Mức độ' : ''}>
                            <Select
                              value={skill.level}
                              onChange={(e) => patchSkill(index, { level: e.target.value })}
                            >
                              <option value={SkillLevel.Beginner}>Cơ bản</option>
                              <option value={SkillLevel.Intermediate}>Trung bình</option>
                              <option value={SkillLevel.Advanced}>Khá</option>
                              <option value={SkillLevel.Expert}>Thành thạo</option>
                            </Select>
                          </Field>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="mb-0.5"
                          onClick={() => removeSkill(index)}
                          disabled={form.skills.length <= 1}
                        >
                          Xoá
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Trình độ">
                      <Select
                        value={form.educationLevel}
                        onChange={(e) => patch('educationLevel', e.target.value)}
                      >
                        <option value="">— Chọn —</option>
                        {EDUCATION_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Trường / cơ sở đào tạo">
                      <Input
                        value={form.educationSchool}
                        onChange={(e) => patch('educationSchool', e.target.value)}
                      />
                    </Field>
                    <Field label="Chuyên ngành">
                      <Input
                        value={form.educationMajor}
                        onChange={(e) => patch('educationMajor', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Chứng chỉ (cách nhau bằng dấu phẩy)">
                    <Input
                      value={form.certificates}
                      onChange={(e) => patch('certificates', e.target.value)}
                      placeholder="VD: ISO 9001, An toàn lao động..."
                    />
                  </Field>
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Thông tin cơ bản
                      </p>
                      <ReviewRow label="Họ tên" value={form.displayName} />
                      <ReviewRow label="Điện thoại" value={form.phone} />
                      <ReviewRow label="Năm sinh" value={form.birthYear} />
                      <ReviewRow label="Thành phố" value={form.currentCity} />
                    </div>

                    <div className="space-y-2 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Mong muốn nghề nghiệp
                      </p>
                      <ReviewRow
                        label="Vị trí"
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
                        label="Lương tối thiểu"
                        value={formatVnd(form.expectedSalaryMin)}
                      />
                      <ReviewRow label="OTE" value={formatVnd(form.expectedOte)} />
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
                      <ReviewRow
                        label="Tìm việc"
                        value={
                          form.jobReadiness
                            ? JOB_READINESS_LABEL[form.jobReadiness as JobReadiness]
                            : '—'
                        }
                      />
                    </div>

                    <div className="space-y-2 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Kinh nghiệm ({filledExperiences.length})
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
                              {exp.startYear || '?'} –{' '}
                              {exp.isCurrent ? 'Hiện tại' : exp.endYear || '?'}
                            </p>
                            {exp.missingFields.length > 0 && (
                              <div className="mt-2">
                                <MissingBadges fields={exp.missingFields} highlight />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Điều kiện công việc
                      </p>
                      <ReviewRow
                        label="Ngoại ngữ"
                        value={form.languages.length > 0 ? form.languages.join(', ') : '—'}
                      />
                      <ReviewRow
                        label="Bằng lái"
                        value={
                          form.hasB2License === 'true'
                            ? `Có${form.driverLicenseType ? ` (${form.driverLicenseType})` : ''}`
                            : form.hasB2License === 'false'
                              ? 'Không'
                              : '—'
                        }
                      />
                      <ReviewRow
                        label="Công tác"
                        value={
                          form.travelAbility
                            ? TRAVEL_ABILITY_LABEL[form.travelAbility as TravelAbility]
                            : '—'
                        }
                      />
                    </div>

                    {(form.educationLevel ||
                      form.educationSchool ||
                      form.educationMajor ||
                      form.certificates.trim()) && (
                      <div className="space-y-2 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Học vấn
                        </p>
                        <ReviewRow label="Trình độ" value={form.educationLevel} />
                        <ReviewRow label="Trường" value={form.educationSchool} />
                        <ReviewRow label="Chuyên ngành" value={form.educationMajor} />
                        <ReviewRow label="Chứng chỉ" value={form.certificates} />
                      </div>
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
                      disabled={
                        saveMutation.isPending ||
                        !form.displayName.trim() ||
                        !form.currentCity.trim()
                      }
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
