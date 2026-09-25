import type { MatchExplanation } from '@industriallink/contracts';
import {
  jobTechnicalCriteriaToMatchJd,
  normalizeJobTechnicalCriteria,
  parseDriverLicenses,
  scoreTechnicalMatch,
  technicalMatchToExplanation,
  type LanguageSkill,
  type TechnicalMatchCompanyInput,
  type TechnicalMatchProfileInput,
} from '@industriallink/contracts';
import type { CandidateExperienceMatchSlice } from './matching.util';

function uniq(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const s = (raw ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function toTechnicalMatchCompanies(
  experiences: CandidateExperienceMatchSlice[] | null | undefined,
): TechnicalMatchCompanyInput[] {
  return (experiences ?? []).map((e, i) => ({
    ten: e.companyName?.trim() || `Công ty ${i + 1}`,
    jobTitle: e.jobTitle ?? null,
    industries: e.industries ?? [],
    equipmentSystems: e.productsSold ?? [],
    workEnvironments: e.customerSegments ?? [],
    technicalWorkTypes: e.sellingStages ?? [],
    startYear: e.startYear ?? null,
    endYear: e.endYear ?? null,
    isCurrent: Boolean(e.isCurrent),
  }));
}

export function toTechnicalMatchProfile(input: {
  profile?: {
    currentPosition?: string | null;
    currentCity?: string | null;
    desiredPositions?: string[] | null;
    desiredLocations?: string[] | null;
    totalExperienceYears?: number | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
    expectedOte?: number | null;
    educationLevel?: string | null;
    educationMajor?: string | null;
    languages?: string[] | null;
    languageSkills?: LanguageSkill[] | null;
    driverLicenseType?: string | null;
    driverLicenses?: string[] | null;
    travelAbility?: string | null;
    certificates?: string[] | null;
    technicalTools?: string[] | null;
    documentLiteracy?: string[] | null;
    shiftFlexibility?: string | null;
    technicalAutonomyLevel?: number | null;
    industry?: string | null;
    industriesExperienced?: string[] | null;
    productsSold?: string[] | null;
    customerSegments?: string[] | null;
    technicalWorkTypes?: string[] | null;
  } | null;
}): TechnicalMatchProfileInput {
  const p = input.profile ?? {};
  const licenses = uniq([
    ...(p.driverLicenses ?? []),
    ...parseDriverLicenses(p.driverLicenseType),
  ]).filter((l) => l !== 'Chưa có');
  return {
    desiredPositions: p.desiredPositions ?? [],
    desiredLocations: p.desiredLocations ?? [],
    currentCity: p.currentCity ?? null,
    currentPosition: p.currentPosition ?? null,
    totalExperienceYears: p.totalExperienceYears ?? null,
    expectedSalaryMin: p.expectedSalaryMin ?? null,
    expectedSalaryMax: p.expectedSalaryMax ?? null,
    expectedOte: p.expectedOte ?? null,
    educationLevel: p.educationLevel ?? null,
    educationMajor: p.educationMajor ?? null,
    languages: p.languages ?? [],
    languageSkills: p.languageSkills ?? [],
    certificates: p.certificates ?? [],
    driverLicenses: licenses,
    travelAbility: p.travelAbility ?? null,
    shiftFlexibility: p.shiftFlexibility ?? null,
    technicalTools: p.technicalTools ?? [],
    documentLiteracy: p.documentLiteracy ?? [],
    autonomyLevel: p.technicalAutonomyLevel ?? null,
    industriesExperienced: uniq([...(p.industriesExperienced ?? []), p.industry]),
    equipmentSystems: p.productsSold ?? [],
    workEnvironments: p.customerSegments ?? [],
    technicalWorkTypes: p.technicalWorkTypes ?? [],
  };
}

/** Chấm JD Kỹ thuật ↔ hồ sơ theo engine 19 trường (không blend embedding). */
export function explainTechnicalJobCandidate(
  job: {
    title?: string | null;
    location?: string | null;
    experienceBand?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    industry?: string | null;
    technicalCriteria?: unknown;
  },
  candidate: {
    profile?: Parameters<typeof toTechnicalMatchProfile>[0]['profile'];
    experiences?: CandidateExperienceMatchSlice[] | null;
  },
): MatchExplanation {
  const tech =
    job.technicalCriteria == null ? null : normalizeJobTechnicalCriteria(job.technicalCriteria);
  const result = scoreTechnicalMatch({
    jd: jobTechnicalCriteriaToMatchJd(job, tech),
    profile: toTechnicalMatchProfile({ profile: candidate.profile }),
    companies: toTechnicalMatchCompanies(candidate.experiences),
  });
  return technicalMatchToExplanation(result);
}
