import type { CvDraftView } from '@industriallink/contracts';

/** Hồ sơ DB tối thiểu để ghép vào draft CV. */
export type ProfileDraftSource = {
  displayName: string;
  email: string;
  profile: {
    currentPosition: string | null;
    summary: string | null;
    careerObjective: string | null;
    phone: string | null;
    currentCity: string | null;
    district: string | null;
    ward: string | null;
    birthYear: number | null;
    birthDate: string | null;
    educationLevel: string | null;
    educationSchool: string | null;
    educationMajor: string | null;
    certificates: string[];
    hobbies: string[];
    productsSold: string[];
    customerSegments: string[];
    marketsCovered: string[];
    industriesExperienced: string[];
    desiredPositions: string[];
    desiredLocations: string[];
    salesHighlights: string | null;
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
    languages: string[];
    careerMotivations: string[];
    workStyles: string[];
    careerOrientation: string | null;
    customerDevStyle: string | null;
    jobTrack: string | null;
    brandsTechnologies: string[];
    technicalWorkTypes: string[];
    technicalAutonomyLevel: number | null;
    troubleshootingLevel: number | null;
    technicalTools: string[];
    documentLiteracy: string[];
    systemScaleNote: string | null;
    shiftFlexibility: string | null;
  } | null;
  aiStrengths: string[];
  skills: { name: string }[];
  experiences: {
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
    latestRevenue: number | null;
    kpiAchievementPct: number | null;
    newCustomerRatioPct: number | null;
    dealType: string | null;
    typicalDealValue: number | null;
    maxDealValue: number | null;
    highlights: string | null;
    jobDescription: string | null;
  }[];
};

function periodOf(e: ProfileDraftSource['experiences'][number]): string {
  const start = e.startYear != null ? String(e.startYear) : '';
  const end = e.isCurrent ? 'Hiện tại' : e.endYear != null ? String(e.endYear) : '';
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

/** Map hồ sơ DB → CvDraftView để ghép với kết quả AI. */
export function profileSourceToCvDraft(src: ProfileDraftSource): CvDraftView {
  const p = src.profile;
  const experience = src.experiences.map((e) => ({
    role: e.jobTitle || p?.currentPosition || 'Sales',
    company: e.companyName || 'Công ty',
    period: periodOf(e),
    bullets: (e.jobDescription || e.highlights || '').trim(),
    industries: e.industries ?? [],
    productsSold: e.productsSold ?? [],
    customerSegments: e.customerSegments ?? [],
    marketsCovered: e.marketsCovered ?? [],
    sellingStages: e.sellingStages ?? [],
    latestRevenue: e.latestRevenue,
    kpiAchievementPct: e.kpiAchievementPct,
    newCustomerRatioPct: e.newCustomerRatioPct,
    dealType: e.dealType,
    typicalDealValue: e.typicalDealValue,
    maxDealValue: e.maxDealValue,
  }));

  const education =
    p?.educationSchool || p?.educationMajor || p?.educationLevel
      ? [
          {
            school: p.educationSchool ?? '',
            degree: [p.educationLevel, p.educationMajor].filter(Boolean).join(' — '),
            period: '',
          },
        ]
      : [];

  const careerOrientations = p?.careerOrientation
    ? p.careerOrientation
        .split(/\s*\|\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    fullName: src.displayName,
    title: p?.desiredPositions?.[0] || p?.currentPosition || '',
    email: src.email,
    phone: p?.phone ?? '',
    location: p?.currentCity || '',
    summary: p?.summary ?? '',
    birthYear: p?.birthYear ?? null,
    birthDate: p?.birthDate ?? null,
    district: null, // không còn cấp huyện (cải cách 01/7/2025)
    ward: p?.ward ?? null,
    educationLevel: p?.educationLevel ?? null,
    careerObjective: p?.careerObjective ?? null,
    skills: src.skills.map((s) => s.name).filter(Boolean),
    softSkills: src.aiStrengths.slice(0, 8),
    languages: p?.languages ?? [],
    hobbies: p?.hobbies ?? [],
    productsSold: p?.productsSold ?? [],
    customerSegments: p?.customerSegments ?? [],
    marketsCovered: p?.marketsCovered ?? [],
    industriesExperienced: p?.industriesExperienced ?? [],
    desiredPositions: p?.desiredPositions ?? [],
    desiredLocations: p?.desiredLocations ?? [],
    salesHighlights: p?.salesHighlights ?? '',
    b2bExperienceBand: p?.b2bExperienceBand ?? null,
    newCustomerRatioPct: p?.newCustomerRatioPct ?? null,
    dealType: p?.dealType ?? null,
    typicalDealValue: p?.typicalDealValue ?? null,
    maxDealValue: p?.maxDealValue ?? null,
    jobReadiness: p?.jobReadiness ?? null,
    availabilityBand: p?.availabilityBand ?? null,
    expectedSalaryMin: p?.expectedSalaryMin ?? null,
    expectedSalaryMax: p?.expectedSalaryMax ?? null,
    expectedOte: p?.expectedOte ?? null,
    travelAbility: p?.travelAbility ?? null,
    hasB2License: p?.hasB2License ?? null,
    driverLicenseType: p?.driverLicenseType ?? null,
    salesBehavior: p?.customerDevStyle ?? null,
    careerMotivations: (p?.careerMotivations ?? []).slice(0, 3),
    careerOrientations,
    workStyles: p?.workStyles ?? [],
    jobTrack:
      p?.jobTrack === 'sales' || p?.jobTrack === 'technical' ? p.jobTrack : null,
    brandsTechnologies: p?.brandsTechnologies ?? [],
    technicalWorkTypes: p?.technicalWorkTypes ?? [],
    technicalAutonomyLevel: p?.technicalAutonomyLevel ?? null,
    troubleshootingLevel: p?.troubleshootingLevel ?? null,
    technicalTools: p?.technicalTools ?? [],
    documentLiteracy: p?.documentLiteracy ?? [],
    systemScaleNote: p?.systemScaleNote ?? null,
    shiftFlexibility: p?.shiftFlexibility ?? null,
    experience,
    education,
    certificates: p?.certificates ?? [],
    projects: [],
  };
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

function pickRicherText(a: string | null | undefined, b: string | null | undefined): string {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (!left) return right;
  if (!right) return left;
  const score = (t: string) => t.length + (t.match(/\n|•/g)?.length ?? 0) * 40;
  return score(left) >= score(right) ? left : right;
}

function pickNonEmpty<T>(a: T | null | undefined, b: T | null | undefined): T | null {
  if (a == null || a === '') return (b ?? null) as T | null;
  return a as T;
}

function unionList(...lists: (string[] | undefined)[]): string[] {
  return [...new Set(lists.flatMap((l) => l ?? []).map((x) => x.trim()).filter(Boolean))];
}

type Exp = CvDraftView['experience'][number];

function mergeExperience(primary: Exp[], fallback: Exp[]): Exp[] {
  const used = new Set<number>();
  const out: Exp[] = [];
  for (const pe of primary) {
    const key = normKey(pe.company);
    const fi = fallback.findIndex(
      (fe, idx) =>
        !used.has(idx) &&
        (normKey(fe.company) === key || normKey(fe.role) === normKey(pe.role)),
    );
    const fe = fi >= 0 ? fallback[fi] : null;
    if (fi >= 0) used.add(fi);
    out.push({
      role: pe.role || fe?.role || 'Sales',
      company: pe.company || fe?.company || 'Công ty',
      period: pe.period || fe?.period || '',
      bullets: pickRicherText(pe.bullets, fe?.bullets),
      industries: unionList(pe.industries, fe?.industries),
      productsSold: unionList(pe.productsSold, fe?.productsSold),
      customerSegments: unionList(pe.customerSegments, fe?.customerSegments),
      marketsCovered: unionList(pe.marketsCovered, fe?.marketsCovered),
      sellingStages: unionList(pe.sellingStages, fe?.sellingStages),
      latestRevenue: pe.latestRevenue ?? fe?.latestRevenue ?? null,
      kpiAchievementPct: pe.kpiAchievementPct ?? fe?.kpiAchievementPct ?? null,
      newCustomerRatioPct: pe.newCustomerRatioPct ?? fe?.newCustomerRatioPct ?? null,
      dealType: pe.dealType || fe?.dealType || null,
      typicalDealValue: pe.typicalDealValue ?? fe?.typicalDealValue ?? null,
      maxDealValue: pe.maxDealValue ?? fe?.maxDealValue ?? null,
    });
  }
  fallback.forEach((fe, idx) => {
    if (!used.has(idx)) out.push(fe);
  });
  return out.slice(0, 12);
}

/** Ghép draft AI với draft từ hồ sơ đã lưu — CV đầy đủ hơn bản gốc. */
export function mergeCvDraftViews(ai: CvDraftView, profile: CvDraftView): CvDraftView {
  const experience = mergeExperience(ai.experience, profile.experience);
  const education =
    ai.education.length > 0
      ? ai.education.map((pe, i) => {
          const fe = profile.education[i];
          return {
            school: pe.school || fe?.school || '',
            degree: pe.degree || fe?.degree || '',
            period: pe.period || fe?.period || '',
          };
        })
      : profile.education;

  return {
    ...profile,
    ...ai,
    fullName: ai.fullName.trim() || profile.fullName,
    title: ai.title.trim() || profile.title,
    email: ai.email.trim() || profile.email,
    phone: ai.phone.trim() || profile.phone,
    location: pickRicherText(ai.location, profile.location),
    summary: pickRicherText(ai.summary, profile.summary),
    birthYear: ai.birthYear ?? profile.birthYear,
    birthDate: pickNonEmpty(ai.birthDate, profile.birthDate),
    district: null, // bỏ huyện khỏi CV draft
    ward: pickNonEmpty(ai.ward, profile.ward),
    educationLevel: pickNonEmpty(ai.educationLevel, profile.educationLevel),
    careerObjective: pickRicherText(ai.careerObjective, profile.careerObjective) || null,
    skills: unionList(ai.skills, profile.skills).slice(0, 24),
    softSkills: unionList(ai.softSkills, profile.softSkills).slice(0, 12),
    languages: unionList(ai.languages, profile.languages),
    hobbies: unionList(ai.hobbies, profile.hobbies),
    productsSold: unionList(ai.productsSold, profile.productsSold),
    customerSegments: unionList(ai.customerSegments, profile.customerSegments),
    marketsCovered: unionList(ai.marketsCovered, profile.marketsCovered),
    industriesExperienced: unionList(ai.industriesExperienced, profile.industriesExperienced),
    desiredPositions: unionList(ai.desiredPositions, profile.desiredPositions).slice(0, 3),
    desiredLocations: unionList(ai.desiredLocations, profile.desiredLocations),
    salesHighlights: pickRicherText(ai.salesHighlights, profile.salesHighlights),
    b2bExperienceBand: pickNonEmpty(ai.b2bExperienceBand, profile.b2bExperienceBand),
    newCustomerRatioPct: ai.newCustomerRatioPct ?? profile.newCustomerRatioPct,
    dealType: pickNonEmpty(ai.dealType, profile.dealType),
    typicalDealValue: ai.typicalDealValue ?? profile.typicalDealValue,
    maxDealValue: ai.maxDealValue ?? profile.maxDealValue,
    jobReadiness: pickNonEmpty(ai.jobReadiness, profile.jobReadiness),
    availabilityBand: pickNonEmpty(ai.availabilityBand, profile.availabilityBand),
    expectedSalaryMin: ai.expectedSalaryMin ?? profile.expectedSalaryMin,
    expectedSalaryMax: ai.expectedSalaryMax ?? profile.expectedSalaryMax,
    expectedOte: ai.expectedOte ?? profile.expectedOte,
    travelAbility: pickNonEmpty(ai.travelAbility, profile.travelAbility),
    hasB2License: ai.hasB2License ?? profile.hasB2License,
    driverLicenseType: pickNonEmpty(ai.driverLicenseType, profile.driverLicenseType),
    salesBehavior: pickNonEmpty(ai.salesBehavior, profile.salesBehavior),
    careerMotivations: unionList(ai.careerMotivations, profile.careerMotivations).slice(0, 3),
    careerOrientations: unionList(ai.careerOrientations, profile.careerOrientations),
    workStyles: unionList(ai.workStyles, profile.workStyles),
    jobTrack: pickNonEmpty(ai.jobTrack, profile.jobTrack),
    brandsTechnologies: unionList(ai.brandsTechnologies, profile.brandsTechnologies),
    technicalWorkTypes: unionList(ai.technicalWorkTypes, profile.technicalWorkTypes),
    technicalAutonomyLevel: ai.technicalAutonomyLevel ?? profile.technicalAutonomyLevel,
    troubleshootingLevel: ai.troubleshootingLevel ?? profile.troubleshootingLevel,
    technicalTools: unionList(ai.technicalTools, profile.technicalTools),
    documentLiteracy: unionList(ai.documentLiteracy, profile.documentLiteracy),
    systemScaleNote: pickRicherText(ai.systemScaleNote, profile.systemScaleNote) || null,
    shiftFlexibility: pickNonEmpty(ai.shiftFlexibility, profile.shiftFlexibility),
    experience,
    education: education.length ? education : profile.education,
    certificates: unionList(ai.certificates, profile.certificates),
    projects: ai.projects.length ? ai.projects : profile.projects,
  };
}
