export type CvTemplateCategory = 'all' | 'modern' | 'professional' | 'creative' | 'minimal';

export interface CvTemplate {
  id: string;
  name: string;
  category: Exclude<CvTemplateCategory, 'all'>;
  accent: string;
  layout: 'sidebar' | 'classic' | 'split';
}

export const CV_TEMPLATE_FILTERS: { id: CvTemplateCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả mẫu' },
  { id: 'modern', label: 'Hiện đại' },
  { id: 'professional', label: 'Chuyên nghiệp' },
  { id: 'creative', label: 'Sáng tạo' },
  { id: 'minimal', label: 'Tối giản' },
];

export const CV_TEMPLATES: CvTemplate[] = [
  { id: 'modern-01', name: 'Hiện đại 01', category: 'modern', accent: '#0B3A6E', layout: 'sidebar' },
  { id: 'modern-02', name: 'Hiện đại 02', category: 'modern', accent: '#0E7490', layout: 'split' },
  { id: 'pro-01', name: 'Chuyên nghiệp 01', category: 'professional', accent: '#1E293B', layout: 'classic' },
  { id: 'pro-02', name: 'Chuyên nghiệp 02', category: 'professional', accent: '#334155', layout: 'sidebar' },
  { id: 'creative-01', name: 'Sáng tạo 01', category: 'creative', accent: '#5B21B6', layout: 'split' },
  { id: 'minimal-01', name: 'Tối giản 01', category: 'minimal', accent: '#0F172A', layout: 'classic' },
];

/** Luồng Tạo CV: nhập → chọn mẫu → tải xuống. */
export const CV_CREATE_STEPS = [
  { id: 1, label: 'Nhập thông tin' },
  { id: 2, label: 'Chọn mẫu CV' },
  { id: 3, label: 'Xem trước & Tải xuống' },
] as const;

export interface CvDraftExperience {
  role: string;
  company: string;
  period: string;
  bullets: string;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
}

export interface CvDraft {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  birthYear: number | null;
  educationLevel: string | null;
  skills: string[];
  softSkills: string[];
  languages: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  industriesExperienced: string[];
  desiredPositions: string[];
  desiredLocations: string[];
  salesHighlights: string;
  b2bExperienceBand: string | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  jobReadiness: string | null;
  availabilityBand: string | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedOte: number | null;
  travelAbility: string | null;
  hasB2License: boolean | null;
  driverLicenseType: string | null;
  salesBehavior: string | null;
  careerMotivations: string[];
  careerOrientations: string[];
  workStyles: string[];
  experience: CvDraftExperience[];
  education: { school: string; degree: string; period: string }[];
  certificates: string[];
  projects: { name: string; detail: string }[];
}

export function emptyCvExperience(): CvDraftExperience {
  return {
    role: '',
    company: '',
    period: '',
    bullets: '',
    industries: [],
    productsSold: [],
    customerSegments: [],
    marketsCovered: [],
    sellingStages: [],
    latestRevenue: null,
    kpiAchievementPct: null,
    newCustomerRatioPct: null,
    dealType: null,
    typicalDealValue: null,
    maxDealValue: null,
  };
}

export function emptyCvDraft(name = '', email = ''): CvDraft {
  return {
    fullName: name,
    title: '',
    email,
    phone: '',
    location: '',
    summary: '',
    birthYear: null,
    educationLevel: null,
    skills: [],
    softSkills: [],
    languages: [],
    productsSold: [],
    customerSegments: [],
    marketsCovered: [],
    industriesExperienced: [],
    desiredPositions: [],
    desiredLocations: [],
    salesHighlights: '',
    b2bExperienceBand: null,
    newCustomerRatioPct: null,
    dealType: null,
    typicalDealValue: null,
    maxDealValue: null,
    jobReadiness: null,
    availabilityBand: null,
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    expectedOte: null,
    travelAbility: null,
    hasB2License: null,
    driverLicenseType: null,
    salesBehavior: null,
    careerMotivations: [],
    careerOrientations: [],
    workStyles: [],
    experience: [],
    education: [],
    certificates: [],
    projects: [],
  };
}

/** Chuẩn hoá draft từ API (thiếu field cũ → default). */
export function normalizeCvDraft(raw: Partial<CvDraft> | null | undefined, fallback?: CvDraft): CvDraft {
  const base = fallback ?? emptyCvDraft();
  const experience = (raw?.experience ?? []).map((e) => ({
    role: e.role ?? '',
    company: e.company ?? '',
    period: e.period ?? '',
    bullets: e.bullets ?? '',
    industries: e.industries ?? [],
    productsSold: e.productsSold ?? [],
    customerSegments: e.customerSegments ?? [],
    marketsCovered: e.marketsCovered ?? [],
    sellingStages: e.sellingStages ?? [],
    latestRevenue: e.latestRevenue ?? null,
    kpiAchievementPct: e.kpiAchievementPct ?? null,
    newCustomerRatioPct: e.newCustomerRatioPct ?? null,
    dealType: e.dealType ?? null,
    typicalDealValue: e.typicalDealValue ?? null,
    maxDealValue: e.maxDealValue ?? null,
  }));
  return {
    fullName: raw?.fullName ?? base.fullName,
    title: raw?.title ?? base.title,
    email: raw?.email ?? base.email,
    phone: raw?.phone ?? base.phone,
    location: raw?.location ?? base.location,
    summary: raw?.summary ?? base.summary,
    birthYear: raw?.birthYear ?? base.birthYear,
    educationLevel: raw?.educationLevel ?? base.educationLevel,
    skills: raw?.skills ?? base.skills,
    softSkills: raw?.softSkills ?? base.softSkills,
    languages: raw?.languages ?? base.languages,
    productsSold: raw?.productsSold ?? base.productsSold,
    customerSegments: raw?.customerSegments ?? base.customerSegments,
    marketsCovered: raw?.marketsCovered ?? base.marketsCovered,
    industriesExperienced: raw?.industriesExperienced ?? base.industriesExperienced,
    desiredPositions: raw?.desiredPositions ?? base.desiredPositions,
    desiredLocations: raw?.desiredLocations ?? base.desiredLocations,
    salesHighlights: raw?.salesHighlights ?? base.salesHighlights,
    b2bExperienceBand: raw?.b2bExperienceBand ?? base.b2bExperienceBand,
    newCustomerRatioPct: raw?.newCustomerRatioPct ?? base.newCustomerRatioPct,
    dealType: raw?.dealType ?? base.dealType,
    typicalDealValue: raw?.typicalDealValue ?? base.typicalDealValue,
    maxDealValue: raw?.maxDealValue ?? base.maxDealValue,
    jobReadiness: raw?.jobReadiness ?? base.jobReadiness,
    availabilityBand: raw?.availabilityBand ?? base.availabilityBand,
    expectedSalaryMin: raw?.expectedSalaryMin ?? base.expectedSalaryMin,
    expectedSalaryMax: raw?.expectedSalaryMax ?? base.expectedSalaryMax,
    expectedOte: raw?.expectedOte ?? base.expectedOte,
    travelAbility: raw?.travelAbility ?? base.travelAbility,
    hasB2License: raw?.hasB2License ?? base.hasB2License,
    driverLicenseType: raw?.driverLicenseType ?? base.driverLicenseType,
    salesBehavior: raw?.salesBehavior ?? base.salesBehavior,
    careerMotivations: raw?.careerMotivations ?? base.careerMotivations,
    careerOrientations: raw?.careerOrientations ?? base.careerOrientations,
    workStyles: raw?.workStyles ?? base.workStyles,
    experience,
    education: raw?.education ?? base.education,
    certificates: raw?.certificates ?? base.certificates,
    projects: raw?.projects ?? base.projects,
  };
}
