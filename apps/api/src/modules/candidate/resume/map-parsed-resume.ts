import type { ParsedResume } from '../../ai/domain/types';
import { normalizeEducationLevel } from '../../ai/providers/llm-parse.util';

/** Dữ liệu ghi CandidateProfile từ kết quả AI parse. */
export function buildProfileDataFromParsed(parsed: ParsedResume) {
  const firstEdu = parsed.education[0];
  const firstExp = parsed.experiences[0];
  const educationLevel =
    normalizeEducationLevel(firstEdu?.level) ??
    normalizeEducationLevel(firstEdu?.degree) ??
    null;

  return {
    currentPosition: parsed.currentPosition,
    jobLevel: parsed.jobLevel,
    totalExperienceYears: parsed.totalExperienceYears,
    industry: parsed.industry,
    specialization: parsed.specialization,
    summary: parsed.summary || null,
    // Không fallback sang summary — giữ mục tiêu nghề nghiệp riêng
    careerObjective: parsed.careerObjective,
    productsSold: parsed.productsSold,
    customerSegments: parsed.customerSegments,
    marketsCovered: parsed.marketsCovered,
    industriesExperienced: parsed.industriesExperienced,
    sellingStages: parsed.sellingStages,
    b2bExperienceBand: parsed.b2bExperienceBand,
    latestRevenue: firstExp?.latestRevenue ?? null,
    kpiAchievementPct: firstExp?.kpiAchievementPct ?? null,
    newCustomerRatioPct: firstExp?.newCustomerRatioPct ?? null,
    dealType: firstExp?.dealType ?? null,
    typicalDealValue: firstExp?.typicalDealValue ?? null,
    maxDealValue: firstExp?.maxDealValue ?? null,
    salesHighlights:
      parsed.salesHighlights ||
      parsed.experiences
        .map((e) => e.highlights)
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ') ||
      null,
    expectedSalaryMin: parsed.expectedSalaryMin != null ? Math.round(parsed.expectedSalaryMin) : null,
    expectedSalaryMax: parsed.expectedSalaryMax != null ? Math.round(parsed.expectedSalaryMax) : null,
    expectedOte: parsed.expectedOte != null ? Math.round(parsed.expectedOte) : null,
    languages: parsed.languages,
    hasB2License: parsed.hasB2License,
    driverLicenseType: parsed.driverLicenseType,
    travelAbility: parsed.travelAbility,
    desiredPositions:
      parsed.desiredPositions.length > 0
        ? parsed.desiredPositions.slice(0, 3)
        : parsed.currentPosition
          ? [parsed.currentPosition]
          : [],
    desiredLocations:
      parsed.desiredLocations.length > 0
        ? parsed.desiredLocations
        : parsed.contact.currentCity
          ? [parsed.contact.currentCity]
          : [],
    jobReadiness: parsed.jobReadiness,
    availabilityBand: parsed.availabilityBand,
    educationLevel,
    educationSchool: firstEdu?.school ?? null,
    educationMajor: firstEdu?.major ?? firstEdu?.degree ?? null,
    certificates: parsed.certificates,
    hobbies: parsed.hobbies,
    birthYear: parsed.contact.birthYear != null ? Math.round(parsed.contact.birthYear) : null,
    birthDate: parsed.contact.birthDate,
    currentCity: parsed.contact.currentCity,
    district: null,
    ward: parsed.contact.ward,
    phone: parsed.contact.phone,
  };
}

/** Dòng CandidateExperience từ một experience AI. */
export function buildExperienceRowFromParsed(
  candidateId: string,
  exp: ParsedResume['experiences'][number],
  sortOrder: number,
) {
  const duties =
    exp.jobDescription ||
    (exp.responsibilities.length
      ? exp.responsibilities.map((r) => (r.startsWith('•') ? r : `• ${r}`)).join('\n')
      : null);

  return {
    candidateId,
    sortOrder,
    companyName: exp.companyName,
    jobTitle: exp.jobTitle,
    startYear: exp.startYear != null ? Math.round(exp.startYear) : null,
    endYear: exp.endYear != null ? Math.round(exp.endYear) : null,
    isCurrent: exp.isCurrent,
    industries: exp.industries,
    productsSold: exp.productsSold,
    customerSegments: exp.customerSegments,
    marketsCovered: exp.marketsCovered,
    sellingStages: exp.sellingStages,
    latestRevenue: exp.latestRevenue,
    kpiAchievementPct: exp.kpiAchievementPct,
    newCustomerRatioPct: exp.newCustomerRatioPct,
    dealType: exp.dealType,
    typicalDealValue: exp.typicalDealValue,
    maxDealValue: exp.maxDealValue,
    // highlights: thành tích; nếu trống thì hiện nhiệm vụ để UI không mất dữ liệu
    highlights: exp.highlights || duties,
    jobDescription: duties,
    missingFields: exp.missingFields,
    source: 'cv_ai' as const,
  };
}
