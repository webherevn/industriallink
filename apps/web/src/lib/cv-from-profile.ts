import type { CandidateView, CvDraftFieldHint } from '@industriallink/contracts';
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

/** Map hồ sơ ứng viên → bản nháp CV (đủ trường Sales B2B). */
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
    skills: uniqueSkills,
    softSkills: [...new Set(softSkills)],
    languages: [...(sales?.languages ?? [])],
    productsSold,
    customerSegments,
    marketsCovered,
    desiredPositions: [...(sales?.desiredPositions ?? [])],
    salesHighlights: sales?.salesHighlights ?? '',
    experience,
    education,
    certificates: [...(p?.certificates ?? [])],
    projects: [],
  };
}

function hintStatus(
  value: string | string[] | undefined | null,
  weakIfShort = 0,
): CvDraftFieldHint['status'] {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'missing';
    return 'filled';
  }
  const t = (value ?? '').trim();
  if (!t) return 'missing';
  if (weakIfShort > 0 && t.length < weakIfShort) return 'weak';
  return 'filled';
}

/** Sinh gợi ý trường từ bản nháp (nạp từ hồ sơ / sau AI). */
export function fieldHintsFromDraft(draft: CvDraft): CvDraftFieldHint[] {
  const defs: {
    key: string;
    label: string;
    value: string | string[];
    suggestion: string;
    weakIfShort?: number;
  }[] = [
    { key: 'fullName', label: 'Họ và tên', value: draft.fullName, suggestion: 'Bổ sung họ tên đầy đủ.' },
    { key: 'title', label: 'Vị trí', value: draft.title, suggestion: 'Thêm vị trí ứng tuyển.' },
    { key: 'email', label: 'Email', value: draft.email, suggestion: 'Thêm email liên hệ.' },
    { key: 'phone', label: 'Số điện thoại', value: draft.phone, suggestion: 'Thêm số điện thoại.' },
    { key: 'location', label: 'Địa điểm', value: draft.location, suggestion: 'Thêm thành phố.' },
    { key: 'skills', label: 'Kỹ năng', value: draft.skills, suggestion: 'Bổ sung kỹ năng chuyên môn.' },
    {
      key: 'summary',
      label: 'Giới thiệu',
      value: draft.summary,
      suggestion: 'Viết đoạn giới thiệu 2–4 câu.',
      weakIfShort: 40,
    },
    {
      key: 'experience',
      label: 'Kinh nghiệm',
      value: draft.experience.map((e) => e.company),
      suggestion: 'Thêm kinh nghiệm công ty.',
    },
    {
      key: 'products',
      label: 'Sản phẩm',
      value: draft.productsSold,
      suggestion: 'Bổ sung sản phẩm đã bán.',
    },
    {
      key: 'segments',
      label: 'Tệp KH',
      value: draft.customerSegments,
      suggestion: 'Bổ sung phân khúc khách hàng.',
    },
    {
      key: 'markets',
      label: 'Thị trường',
      value: draft.marketsCovered,
      suggestion: 'Bổ sung khu vực phụ trách.',
    },
    {
      key: 'education',
      label: 'Học vấn',
      value: draft.education.map((e) => e.school || e.degree),
      suggestion: 'Bổ sung học vấn.',
    },
    {
      key: 'certificates',
      label: 'Chứng chỉ',
      value: draft.certificates,
      suggestion: 'Thêm chứng chỉ nếu có.',
    },
    {
      key: 'languages',
      label: 'Ngoại ngữ',
      value: draft.languages,
      suggestion: 'Thêm ngoại ngữ.',
    },
  ];

  return defs.map((d) => {
    const status = hintStatus(d.value, d.weakIfShort);
    const display = Array.isArray(d.value) ? d.value.join(', ') : d.value;
    return {
      key: d.key,
      label: d.label,
      status,
      value: display.trim() || null,
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
      (p?.certificates?.length ?? 0) > 0,
  );
}
