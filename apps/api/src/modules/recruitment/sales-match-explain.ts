import type { MatchExplanation } from '@industriallink/contracts';
import {
  jobSalesCriteriaToMatchJd,
  normalizeJobSalesCriteria,
  parseDriverLicenses,
  salesMatchToExplanation,
  scoreSalesMatch,
  splitDealTypes,
  type SalesMatchCompanyInput,
  type SalesMatchProfileInput,
  type LanguageSkill,
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

export function toSalesMatchCompanies(
  experiences: CandidateExperienceMatchSlice[] | null | undefined,
): SalesMatchCompanyInput[] {
  return (experiences ?? []).map((e, i) => ({
    ten: e.companyName?.trim() || `Công ty ${i + 1}`,
    jobTitle: e.jobTitle ?? null,
    industries: e.industries ?? [],
    productsSold: e.productsSold ?? [],
    customerSegments: e.customerSegments ?? [],
    dealTypes: splitDealTypes(e.dealType),
    sellingStages: e.sellingStages ?? [],
    marketsCovered: e.marketsCovered ?? [],
    startYear: e.startYear ?? null,
    endYear: e.endYear ?? null,
    isCurrent: Boolean(e.isCurrent),
  }));
}

export function toSalesMatchProfile(input: {
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
    industry?: string | null;
    industriesExperienced?: string[] | null;
    productsSold?: string[] | null;
    customerSegments?: string[] | null;
    dealType?: string | null;
    sellingStages?: string[] | null;
    marketsCovered?: string[] | null;
  } | null;
}): SalesMatchProfileInput {
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
    driverLicenses: licenses,
    travelAbility: p.travelAbility ?? null,
    industriesExperienced: uniq([...(p.industriesExperienced ?? []), p.industry]),
    productsSold: p.productsSold ?? [],
    customerSegments: p.customerSegments ?? [],
    dealTypes: splitDealTypes(p.dealType),
    sellingStages: p.sellingStages ?? [],
    marketsCovered: p.marketsCovered ?? [],
  };
}

/** Chấm JD Sales ↔ hồ sơ theo engine 16 trường (không blend embedding). */
export function explainSalesJobCandidate(
  job: {
    title?: string | null;
    location?: string | null;
    experienceBand?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    industry?: string | null;
    salesCriteria?: unknown;
  },
  candidate: {
    profile?: Parameters<typeof toSalesMatchProfile>[0]['profile'];
    experiences?: CandidateExperienceMatchSlice[] | null;
  },
): MatchExplanation {
  const sales =
    job.salesCriteria == null ? null : normalizeJobSalesCriteria(job.salesCriteria);
  const result = scoreSalesMatch({
    jd: jobSalesCriteriaToMatchJd(job, sales),
    profile: toSalesMatchProfile({ profile: candidate.profile }),
    companies: toSalesMatchCompanies(candidate.experiences),
  });
  return salesMatchToExplanation(result);
}
