import type { CandidateView, CvDraftFieldHint } from '@industriallink/contracts';
import { SALES_BEHAVIOR_OPTIONS } from '@industriallink/contracts';
import { emptyCvDraft, type CvDraft } from './cv-templates';

function experiencePeriod(exp: {
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
}): string {
  const start = exp.startYear != null ? String(exp.startYear) : '';
  const end = exp.isCurrent ? 'Hiện tại' : exp.endYear != null ? String(exp.endYear) : '';
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

function pickSalesBehavior(sales: {
  salesBehavior?: string | null;
  customerDevStyle?: string | null;
} | null | undefined): string | null {
  if (!sales) return null;
  const raw = sales.salesBehavior ?? sales.customerDevStyle ?? null;
  if (!raw) return null;
  if ((SALES_BEHAVIOR_OPTIONS as readonly string[]).includes(raw)) return raw;
  return raw;
}

/** Map hồ sơ ứng viên → bản nháp CV (đủ trường Sales B2B / ma trận ~39). */
export function draftFromCandidate(candidate: CandidateView, email: string): CvDraft {
  const p = candidate.profile;
  const sales = p?.sales;
  const skills = [
    ...candidate.skills.map((s) => s.name.replace(/\r/g, '').trim()).filter(Boolean),
  ];
  const uniqueSkills = [...new Set(skills)];

  const softSkills = [...(candidate.aiProfile?.strengths ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);

  const experience =
    candidate.experiences.length > 0
      ? candidate.experiences.map((e) => ({
          role: e.jobTitle || p?.currentPosition || 'Vị trí',
          company: e.companyName || 'Công ty',
          period: experiencePeriod(e),
          bullets: [e.highlights, e.jobDescription].filter(Boolean).join('\n'),
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
        }))
      : p?.currentPosition
        ? [
            {
              role: p.currentPosition,
              company: p.industry || 'Công ty',
              period: p.totalExperienceYears
                ? `${p.totalExperienceYears} năm kinh nghiệm`
                : '',
              bullets: sales?.salesHighlights ?? p.summary ?? '',
              industries: p.industriesExperienced ?? [],
              productsSold: sales?.productsSold ?? [],
              customerSegments: sales?.customerSegments ?? [],
              marketsCovered: sales?.marketsCovered ?? [],
              sellingStages: sales?.sellingStages ?? [],
              latestRevenue: sales?.latestRevenue ?? null,
              kpiAchievementPct: sales?.kpiAchievementPct ?? null,
              newCustomerRatioPct: sales?.newCustomerRatioPct ?? null,
              dealType: sales?.dealType ?? null,
              typicalDealValue: sales?.typicalDealValue ?? null,
              maxDealValue: sales?.maxDealValue ?? null,
            },
          ]
        : [];

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

  const productsSold = [
    ...new Set([
      ...(sales?.productsSold ?? []),
      ...experience.flatMap((e) => e.productsSold),
    ]),
  ];
  const customerSegments = [
    ...new Set([
      ...(sales?.customerSegments ?? []),
      ...experience.flatMap((e) => e.customerSegments),
    ]),
  ];
  const marketsCovered = [
    ...new Set([
      ...(sales?.marketsCovered ?? []),
      ...experience.flatMap((e) => e.marketsCovered),
    ]),
  ];
  const industriesExperienced = [
    ...new Set([
      ...(p?.industriesExperienced ?? []),
      ...experience.flatMap((e) => e.industries),
    ]),
  ];

  const careerOrientations =
    sales?.careerOrientations?.length
      ? [...sales.careerOrientations]
      : sales?.careerOrientation
        ? sales.careerOrientation
            .split(/\s*\|\s*/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

  return {
    ...emptyCvDraft(),
    fullName: (candidate.displayName ?? '').replace(/\r/g, '').trim(),
    title: (
      sales?.desiredPositions?.[0] ||
      p?.currentPosition ||
      p?.specialization ||
      ''
    ).trim(),
    email: email.trim(),
    phone: (p?.phone ?? '').trim(),
    location: (p?.currentCity || sales?.desiredLocations?.[0] || '').trim(),
    summary: (
      p?.summary ||
      p?.careerObjective ||
      candidate.aiProfile?.summary ||
      sales?.salesHighlights ||
      ''
    ).trim(),
    birthYear: p?.birthYear ?? null,
    educationLevel: p?.educationLevel ?? null,
    skills: uniqueSkills,
    softSkills: [...new Set(softSkills)],
    languages: [...(sales?.languages ?? [])],
    productsSold,
    customerSegments,
    marketsCovered,
    industriesExperienced,
    desiredPositions: [...(sales?.desiredPositions ?? [])],
    desiredLocations: [...(sales?.desiredLocations ?? [])],
    salesHighlights: sales?.salesHighlights ?? '',
    b2bExperienceBand: sales?.b2bExperienceBand ?? null,
    newCustomerRatioPct: sales?.newCustomerRatioPct ?? null,
    dealType: sales?.dealType ?? null,
    typicalDealValue: sales?.typicalDealValue ?? null,
    maxDealValue: sales?.maxDealValue ?? null,
    jobReadiness: sales?.jobReadiness ?? null,
    availabilityBand: sales?.availabilityBand ?? null,
    expectedSalaryMin: sales?.expectedSalaryMin ?? null,
    expectedSalaryMax: sales?.expectedSalaryMax ?? null,
    expectedOte: sales?.expectedOte ?? null,
    travelAbility: sales?.travelAbility ?? null,
    hasB2License: sales?.hasB2License ?? null,
    driverLicenseType: sales?.driverLicenseType ?? null,
    salesBehavior: pickSalesBehavior(sales),
    careerMotivations: [...(sales?.careerMotivations ?? [])].slice(0, 3),
    careerOrientations,
    workStyles: [...(sales?.workStyles ?? [])],
    experience,
    education,
    certificates: [...(p?.certificates ?? [])],
    projects: [],
  };
}

function hintStatus(
  value: string | string[] | number | boolean | null | undefined,
  weakIfShort = 0,
): CvDraftFieldHint['status'] {
  if (typeof value === 'boolean') return 'filled';
  if (typeof value === 'number') return Number.isFinite(value) ? 'filled' : 'missing';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'missing';
    return 'filled';
  }
  const t = (value ?? '').toString().trim();
  if (!t) return 'missing';
  if (weakIfShort > 0 && t.length < weakIfShort) return 'weak';
  return 'filled';
}

function displayValue(
  value: string | string[] | number | boolean | null | undefined,
): string | null {
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  const t = (value ?? '').toString().trim();
  return t || null;
}

/** Sinh gợi ý trường từ bản nháp — checklist ma trận ~39 mục. */
export function fieldHintsFromDraft(draft: CvDraft): CvDraftFieldHint[] {
  const firstExp = draft.experience[0];
  const defs: {
    key: string;
    label: string;
    value: string | string[] | number | boolean | null | undefined;
    suggestion: string;
    weakIfShort?: number;
  }[] = [
    // Định danh CV
    { key: 'fullName', label: 'Họ và tên', value: draft.fullName, suggestion: 'Bổ sung họ tên đầy đủ.' },
    { key: 'title', label: 'Vị trí', value: draft.title, suggestion: 'Thêm vị trí ứng tuyển.' },
    { key: 'email', label: 'Email', value: draft.email, suggestion: 'Thêm email liên hệ.' },
    { key: 'phone', label: 'Số điện thoại', value: draft.phone, suggestion: 'Thêm số điện thoại.' },
    { key: 'location', label: 'Địa điểm hiện tại', value: draft.location, suggestion: 'Thêm thành phố.' },
    { key: 'birthYear', label: 'Năm sinh', value: draft.birthYear, suggestion: 'Thêm năm sinh.' },
    {
      key: 'summary',
      label: 'Giới thiệu',
      value: draft.summary,
      suggestion: 'Viết đoạn giới thiệu 2–4 câu.',
      weakIfShort: 40,
    },
    { key: 'skills', label: 'Kỹ năng', value: draft.skills, suggestion: 'Bổ sung kỹ năng chuyên môn.' },
    {
      key: 'experience',
      label: 'Kinh nghiệm công ty',
      value: draft.experience.map((e) => e.company),
      suggestion: 'Thêm kinh nghiệm công ty.',
    },
    {
      key: 'education',
      label: 'Học vấn',
      value: draft.education.map((e) => e.school || e.degree),
      suggestion: 'Bổ sung học vấn.',
    },
    {
      key: 'educationLevel',
      label: 'Trình độ học vấn',
      value: draft.educationLevel,
      suggestion: 'Chọn trình độ (CĐ/ĐH…).',
    },
    {
      key: 'certificates',
      label: 'Chứng chỉ',
      value: draft.certificates,
      suggestion: 'Thêm chứng chỉ nếu có.',
    },
    // A. Năng lực lõi
    {
      key: 'industries',
      label: 'Ngành công nghiệp',
      value: draft.industriesExperienced.length
        ? draft.industriesExperienced
        : (firstExp?.industries ?? []),
      suggestion: 'Chọn ngành đã làm.',
    },
    {
      key: 'products',
      label: 'Sản phẩm đã bán',
      value: draft.productsSold,
      suggestion: 'Bổ sung sản phẩm đã bán.',
    },
    {
      key: 'segments',
      label: 'Tệp khách hàng',
      value: draft.customerSegments,
      suggestion: 'Bổ sung phân khúc khách hàng.',
    },
    {
      key: 'revenue',
      label: 'Doanh số gần nhất',
      value: firstExp?.latestRevenue ?? null,
      suggestion: 'Thêm doanh số gần nhất.',
    },
    {
      key: 'kpi',
      label: '% hoàn thành KPI',
      value: firstExp?.kpiAchievementPct ?? null,
      suggestion: 'Thêm % KPI gần nhất.',
    },
    {
      key: 'newCustomerRatio',
      label: 'Tỷ lệ KH tự phát triển',
      value: draft.newCustomerRatioPct ?? firstExp?.newCustomerRatioPct ?? null,
      suggestion: 'Thêm tỷ lệ khách tự tìm.',
    },
    {
      key: 'b2bExperience',
      label: 'Kinh nghiệm Sales B2B',
      value: draft.b2bExperienceBand,
      suggestion: 'Chọn band kinh nghiệm B2B.',
    },
    {
      key: 'sellingStages',
      label: 'Giai đoạn bán hàng',
      value: firstExp?.sellingStages ?? [],
      suggestion: 'Tick các giai đoạn đã làm.',
    },
    {
      key: 'dealType',
      label: 'Loại thương vụ',
      value: draft.dealType ?? firstExp?.dealType ?? null,
      suggestion: 'Chọn loại deal (project/OEM…).',
    },
    {
      key: 'dealValue',
      label: 'Giá trị deal điển hình',
      value: draft.typicalDealValue ?? firstExp?.typicalDealValue ?? null,
      suggestion: 'Thêm giá trị deal điển hình.',
    },
    {
      key: 'maxDeal',
      label: 'Deal lớn nhất',
      value: draft.maxDealValue ?? firstExp?.maxDealValue ?? null,
      suggestion: 'Thêm giá trị deal lớn nhất.',
    },
    {
      key: 'markets',
      label: 'Thị trường phụ trách',
      value: draft.marketsCovered,
      suggestion: 'Bổ sung khu vực phụ trách.',
    },
    {
      key: 'salesHighlights',
      label: 'Điểm nổi bật Sales',
      value: draft.salesHighlights,
      suggestion: 'Tóm tắt thành tích Sales.',
      weakIfShort: 20,
    },
    // B. Điều kiện
    {
      key: 'jobReadiness',
      label: 'Mức độ tìm việc',
      value: draft.jobReadiness,
      suggestion: 'Chọn mức độ sẵn sàng tìm việc.',
    },
    {
      key: 'availability',
      label: 'Thời gian nhận việc',
      value: draft.availabilityBand,
      suggestion: 'Chọn thời gian có thể nhận việc.',
    },
    {
      key: 'languages',
      label: 'Ngoại ngữ',
      value: draft.languages,
      suggestion: 'Thêm ngoại ngữ.',
    },
    {
      key: 'travel',
      label: 'Khả năng đi công tác',
      value: draft.travelAbility,
      suggestion: 'Chọn khả năng công tác.',
    },
    {
      key: 'driversLicense',
      label: 'Bằng lái ô tô',
      value:
        draft.hasB2License == null
          ? null
          : draft.hasB2License
            ? draft.driverLicenseType || 'Có'
            : 'Không',
      suggestion: 'Cho biết có bằng lái hay không.',
    },
    {
      key: 'expectedSalary',
      label: 'Thu nhập kỳ vọng',
      value: draft.expectedSalaryMin ?? draft.expectedOte ?? null,
      suggestion: 'Thêm lương tối thiểu / OTE.',
    },
    {
      key: 'desiredPositions',
      label: 'Vị trí mong muốn',
      value: draft.desiredPositions,
      suggestion: 'Chọn vị trí mong muốn.',
    },
    {
      key: 'desiredLocations',
      label: 'Địa điểm mong muốn',
      value: draft.desiredLocations,
      suggestion: 'Thêm địa điểm mong muốn làm việc.',
    },
    // C. Phù hợp
    {
      key: 'salesBehavior',
      label: 'Phong cách & hành vi Sales',
      value: draft.salesBehavior,
      suggestion: 'Chọn ưu tiên hành vi Sales (A–D).',
    },
    {
      key: 'careerMotivations',
      label: 'Động lực nghề nghiệp',
      value: draft.careerMotivations,
      suggestion: 'Chọn đúng 3 động lực quan trọng nhất.',
    },
    {
      key: 'careerOrientations',
      label: 'Định hướng nghề nghiệp',
      value: draft.careerOrientations,
      suggestion: 'Chọn hướng phát triển 2–3 năm tới.',
    },
    {
      key: 'cultureFit',
      label: 'Phù hợp văn hóa',
      value: draft.workStyles,
      suggestion: 'Trả lời các câu matching văn hóa.',
    },
  ];

  return defs.map((d) => {
    const status = hintStatus(d.value, d.weakIfShort);
    return {
      key: d.key,
      label: d.label,
      status,
      value: displayValue(d.value),
      suggestion: status === 'filled' ? '' : d.suggestion,
    };
  });
}

export function candidateHasCvSource(candidate: CandidateView | undefined): boolean {
  if (!candidate) return false;
  const p = candidate.profile;
  return Boolean(
    candidate.displayName?.trim() ||
      candidate.skills.length > 0 ||
      candidate.experiences.length > 0 ||
      p?.summary ||
      p?.currentPosition ||
      p?.phone ||
      p?.educationSchool ||
      (p?.certificates?.length ?? 0) > 0 ||
      (p?.sales?.careerMotivations?.length ?? 0) > 0 ||
      p?.sales?.salesBehavior ||
      (p?.sales?.workStyles?.length ?? 0) > 0,
  );
}
