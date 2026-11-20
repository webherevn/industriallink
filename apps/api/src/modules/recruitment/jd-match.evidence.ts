import type { JdMatchEvidenceContext } from './jd-match.builder';

/**
 * Bằng chứng 2 vế cho mỗi tiêu chí: "JD yêu cầu ..." vs "Ứng viên: ...".
 *
 * Mục tiêu: NTD thấy ngay chỗ lệch mà không phải mở bảng chi tiết.
 */

const EXPERIENCE_LABEL_FALLBACK: Record<string, string> = {
  none: 'Không yêu cầu',
  under1: 'Dưới 1 năm',
  from1to3: '1–3 năm',
  from3to5: '3–5 năm',
  over5: 'Trên 5 năm',
};

/** Định dạng tiền VND ngắn gọn (không phụ thuộc lib web). */
function formatVndAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    const ty = n / 1_000_000_000;
    const text =
      Math.abs(ty - Math.round(ty)) < 1e-9
        ? Math.round(ty).toLocaleString('vi-VN')
        : ty.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${text} tỷ`;
  }
  if (abs >= 1_000_000) {
    const tr = n / 1_000_000;
    const text =
      Math.abs(tr - Math.round(tr)) < 1e-9
        ? Math.round(tr).toLocaleString('vi-VN')
        : tr.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${text} tr`;
  }
  return `${Math.round(n).toLocaleString('vi-VN')} đ`;
}

function experienceText(band: string | null | undefined): string | null {
  if (!band) return null;
  return EXPERIENCE_LABEL_FALLBACK[band] ?? band;
}

function joinList(values: string[] | null | undefined, max = 4): string | null {
  const list = (values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} +${list.length - max}`;
}

function salaryText(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${formatVndAmount(min)}–${formatVndAmount(max)}`;
  if (min != null) return `Từ ${formatVndAmount(min)}`;
  return `Tối đa ${formatVndAmount(max!)}`;
}

export interface SalesEvidenceInput {
  jobTitle?: string | null;
  jobLocation?: string | null;
  experienceBand?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salesCriteria: {
    industries: string[];
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
  };
  candidate: {
    desiredPositions?: string[];
    desiredLocations?: string[];
    currentCity?: string | null;
    currentPosition?: string | null;
    totalExperienceYears?: number | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
    educationLevel?: string | null;
    educationMajor?: string | null;
    languages?: string[];
    driverLicenses?: string[];
    travelAbility?: string | null;
    industriesExperienced?: string[];
    industry?: string | null;
    productsSold?: string[];
    customerSegments?: string[];
    dealTypes?: string[];
    sellingStages?: string[];
    marketsCovered?: string[];
  };
  /** Dữ liệu kinh nghiệm (công ty) — bằng chứng cho nhóm "Kinh nghiệm thực chiến". */
  experiences: Array<{
    companyName?: string | null;
    jobTitle?: string | null;
    industries?: string[];
    productsSold?: string[];
    customerSegments?: string[];
    dealType?: string | null;
    sellingStages?: string[];
    marketsCovered?: string[];
  }>;
}

/** Bằng chứng cho track Sales (16 trường jd01a…jd18). */
export function buildSalesEvidence(input: SalesEvidenceInput): JdMatchEvidenceContext {
  const { jobTitle, salesCriteria: jd, candidate: cd, experiences } = input;

  // Doanh nghiệp được chấm điểm cao nhất = nguồn bằng chứng "Kinh nghiệm thực chiến".
  const best = experiences[0] ?? null;
  const candidateIndustries = joinList([
    ...(cd.industriesExperienced ?? []),
    ...(cd.industry ? [cd.industry] : []),
  ]);

  const jdRequirements: Record<string, string | null | undefined> = {
    jd01a: jobTitle ?? null,
    jd01b: jobTitle ? `Có kinh nghiệm ở vị trí «${jobTitle}»` : null,
    jd02: joinList(jd.industries),
    jd04: input.jobLocation ?? null,
    jd05: experienceText(input.experienceBand),
    jd06: salaryText(input.salaryMin, input.salaryMax),
    jd09: joinList(jd.productsSold),
    jd10: joinList(jd.customerSegments),
    jd11: joinList(jd.dealTypes),
    jd12: joinList(jd.sellingStages),
    jd13: joinList(jd.marketsCovered),
    jd14: jd.educationLevel,
    jd15: jd.educationMajor,
    jd16: joinList(jd.languages),
    jd17: joinList(jd.driverLicenses),
    jd18: jd.travelAbility,
  };

  const candidateEvidence: Record<string, string | null | undefined> = {
    jd01a: joinList(cd.desiredPositions, 2),
    jd01b: best?.jobTitle ?? cd.currentPosition ?? null,
    jd02: candidateIndustries,
    jd04: joinList([...(cd.desiredLocations ?? []), ...(cd.currentCity ? [cd.currentCity] : [])], 2),
    jd05:
      cd.totalExperienceYears != null ? `${cd.totalExperienceYears} năm kinh nghiệm` : null,
    jd06: salaryText(cd.expectedSalaryMin, cd.expectedSalaryMax),
    jd09: joinList(best?.productsSold ?? cd.productsSold),
    jd10: joinList(best?.customerSegments ?? cd.customerSegments),
    jd11: joinList(best?.dealType ? [best.dealType] : cd.dealTypes),
    jd12: joinList(best?.sellingStages ?? cd.sellingStages),
    jd13: joinList(best?.marketsCovered ?? cd.marketsCovered),
    jd14: cd.educationLevel,
    jd15: cd.educationMajor,
    jd16: joinList(cd.languages),
    jd17: joinList(cd.driverLicenses),
    jd18: cd.travelAbility,
  };

  return { jobTitle: jobTitle ?? null, jdRequirements, candidateEvidence };
}

export interface TechnicalEvidenceInput {
  jobTitle?: string | null;
  jobLocation?: string | null;
  experienceBand?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  technicalCriteria: {
    position?: string | null;
    industries: string[];
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
  };
  candidate: {
    desiredPositions?: string[];
    desiredLocations?: string[];
    currentCity?: string | null;
    currentPosition?: string | null;
    totalExperienceYears?: number | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
    educationLevel?: string | null;
    educationMajor?: string | null;
    languages?: string[];
    driverLicenses?: string[];
    travelAbility?: string | null;
    shiftFlexibility?: string | null;
    technicalTools?: string[];
    documentLiteracy?: string[];
    technicalAutonomyLevel?: number | null;
    industriesExperienced?: string[];
    industry?: string | null;
    productsSold?: string[];
    customerSegments?: string[];
    sellingStages?: string[];
  };
  experiences: Array<{
    companyName?: string | null;
    jobTitle?: string | null;
    industries?: string[];
    productsSold?: string[];
    customerSegments?: string[];
    sellingStages?: string[];
    technicalAutonomyLevel?: number | null;
  }>;
}

/** Bằng chứng cho track Kỹ thuật (19 trường tech.jd01a…tech.jd20). */
export function buildTechnicalEvidence(input: TechnicalEvidenceInput): JdMatchEvidenceContext {
  const { jobTitle, technicalCriteria: jd, candidate: cd, experiences } = input;
  const best = experiences[0] ?? null;

  const jdRequirements: Record<string, string | null | undefined> = {
    'tech.jd01a': jobTitle ?? null,
    'tech.jd01b': jobTitle ? `Có kinh nghiệm ở vị trí «${jobTitle}»` : null,
    'tech.jd02': joinList(jd.industries),
    'tech.jd03': input.jobLocation ?? null,
    'tech.jd04': experienceText(input.experienceBand),
    'tech.jd05': salaryText(input.salaryMin, input.salaryMax),
    'tech.jd08': joinList(jd.equipmentSystems),
    'tech.jd09': joinList(jd.workEnvironments),
    'tech.jd10': joinList(jd.technicalWorkTypes),
    'tech.jd11': jd.autonomyLevel != null ? `Mức tự chủ tối thiểu ${jd.autonomyLevel}/5` : null,
    'tech.jd12': jd.educationLevel,
    'tech.jd13': jd.educationMajor,
    'tech.jd14': joinList(jd.languages),
    'tech.jd15': joinList(jd.certificates),
    'tech.jd16': joinList(jd.driverLicenses),
    'tech.jd17': jd.travelAbility,
    'tech.jd18': jd.shiftFlexibility,
    'tech.jd19': joinList(jd.technicalTools),
    'tech.jd20': joinList(jd.documentLiteracy),
  };

  const candidateEvidence: Record<string, string | null | undefined> = {
    'tech.jd01a': joinList(cd.desiredPositions, 2),
    'tech.jd01b': best?.jobTitle ?? cd.currentPosition ?? null,
    'tech.jd02': joinList([
      ...(cd.industriesExperienced ?? []),
      ...(cd.industry ? [cd.industry] : []),
    ]),
    'tech.jd03': joinList([...(cd.desiredLocations ?? []), ...(cd.currentCity ? [cd.currentCity] : [])], 2),
    'tech.jd04':
      cd.totalExperienceYears != null ? `${cd.totalExperienceYears} năm kinh nghiệm` : null,
    'tech.jd05': salaryText(cd.expectedSalaryMin, cd.expectedSalaryMax),
    'tech.jd08': joinList(best?.productsSold ?? cd.productsSold),
    'tech.jd09': joinList(best?.customerSegments ?? cd.customerSegments),
    'tech.jd10': joinList(best?.sellingStages ?? cd.sellingStages),
    'tech.jd11':
      best?.technicalAutonomyLevel != null
        ? `Mức tự chủ ${best.technicalAutonomyLevel}/5`
        : cd.technicalAutonomyLevel != null
          ? `Mức tự chủ ${cd.technicalAutonomyLevel}/5`
          : null,
    'tech.jd12': cd.educationLevel,
    'tech.jd13': cd.educationMajor,
    'tech.jd14': joinList(cd.languages),
    'tech.jd15': null,
    'tech.jd16': joinList(cd.driverLicenses),
    'tech.jd17': cd.travelAbility,
    'tech.jd18': cd.shiftFlexibility,
    'tech.jd19': joinList(cd.technicalTools),
    'tech.jd20': joinList(cd.documentLiteracy),
  };

  return { jobTitle: jobTitle ?? null, jdRequirements, candidateEvidence };
}
