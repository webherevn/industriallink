import type { CandidateView, CvDraftFieldHint } from '@industriallink/contracts';
import { JobTrack, SALES_BEHAVIOR_OPTIONS, SALES_HIGHLIGHTS_HINT, TRACK_FIELD_LABELS, TECHNICAL_HIGHLIGHTS_HINT } from '@industriallink/contracts';
import { toBulletText } from './bullet-text';
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
          bullets: (e.jobDescription || e.highlights || '').trim(),
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
      candidate.aiProfile?.summary ||
      ''
    ).trim(),
    birthYear: p?.birthYear ?? null,
    birthDate: p?.birthDate ?? null,
    district: null, // không còn cấp huyện (cải cách 01/7/2025)
    ward: p?.ward ?? null,
    educationLevel: p?.educationLevel ?? null,
    careerObjective: p?.careerObjective ?? null,
    skills: uniqueSkills,
    softSkills: [...new Set(softSkills)],
    languages: [...(sales?.languages ?? [])],
    hobbies: [...(p?.hobbies ?? [])],
    productsSold,
    customerSegments,
    marketsCovered,
    industriesExperienced,
    desiredPositions: [...(sales?.desiredPositions ?? [])],
    desiredLocations: [...(sales?.desiredLocations ?? [])],
    salesHighlights: toBulletText(sales?.salesHighlights ?? ''),
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
    jobTrack: p?.jobTrack ?? null,
    brandsTechnologies: [...(p?.brandsTechnologies ?? [])],
    technicalWorkTypes: [...(p?.technicalWorkTypes ?? [])],
    technicalAutonomyLevel: p?.technicalAutonomyLevel ?? null,
    troubleshootingLevel: p?.troubleshootingLevel ?? null,
    technicalTools: [...(p?.technicalTools ?? [])],
    documentLiteracy: [...(p?.documentLiteracy ?? [])],
    systemScaleNote: p?.systemScaleNote ?? null,
    shiftFlexibility: p?.shiftFlexibility ?? null,
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
    {
      key: 'location',
      label: 'Tỉnh / Thành phố',
      value: draft.location,
      suggestion: 'Chọn tỉnh/thành theo đơn vị hành chính mới.',
    },
    { key: 'birthYear', label: 'Năm sinh', value: draft.birthYear ?? draft.birthDate, suggestion: 'Thêm ngày/năm sinh.' },
    {
      key: 'ward',
      label: 'Xã / Phường / Đặc khu',
      value: draft.ward,
      suggestion: 'Thêm xã/phường (có thể bỏ trống).',
    },
    {
      key: 'summary',
      label: 'Giới thiệu',
      value: draft.summary,
      suggestion: 'Viết đoạn giới thiệu 2–4 câu.',
      weakIfShort: 40,
    },
    {
      key: 'careerObjective',
      label: 'Mục tiêu nghề nghiệp',
      value: draft.careerObjective,
      suggestion: 'Thêm mục tiêu nghề nghiệp.',
      weakIfShort: 20,
    },
    { key: 'hobbies', label: 'Sở thích', value: draft.hobbies, suggestion: 'Thêm sở thích nếu có.' },
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
      label:
        draft.jobTrack === 'technical'
          ? TRACK_FIELD_LABELS.productsSold[JobTrack.Technical]
          : TRACK_FIELD_LABELS.productsSold[JobTrack.Sales],
      value: draft.productsSold,
      suggestion:
        draft.jobTrack === 'technical'
          ? 'Bổ sung thiết bị / hệ thống đã làm.'
          : 'Bổ sung sản phẩm đã bán.',
    },
    {
      key: 'segments',
      label:
        draft.jobTrack === 'technical'
          ? TRACK_FIELD_LABELS.customerSegments[JobTrack.Technical]
          : TRACK_FIELD_LABELS.customerSegments[JobTrack.Sales],
      value: draft.customerSegments,
      suggestion:
        draft.jobTrack === 'technical'
          ? 'Bổ sung môi trường làm việc.'
          : 'Bổ sung phân khúc khách hàng.',
    },
    ...(draft.jobTrack === 'technical'
      ? []
      : [
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
        ]),
    {
      key: 'salesHighlights',
      label:
        draft.jobTrack === 'technical'
          ? TRACK_FIELD_LABELS.salesHighlights[JobTrack.Technical]
          : TRACK_FIELD_LABELS.salesHighlights[JobTrack.Sales],
      value: draft.salesHighlights,
      suggestion:
        draft.jobTrack === 'technical'
          ? `Ghi theo: ${TECHNICAL_HIGHLIGHTS_HINT}`
          : `Ghi theo: ${SALES_HIGHLIGHTS_HINT}`,
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
    ...(draft.jobTrack === 'technical'
      ? []
      : [
          {
            key: 'salesBehavior',
            label: 'Phong cách & hành vi Sales',
            value: draft.salesBehavior,
            suggestion: 'Chọn ưu tiên hành vi Sales (A–D).',
          },
        ]),
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
    // D. Kỹ thuật (khi jobTrack = technical)
    ...(draft.jobTrack === 'technical'
      ? [
          {
            key: 'jobTrack',
            label: 'Lĩnh vực',
            value: draft.jobTrack,
            suggestion: 'Chọn Sales hoặc Kỹ thuật.',
          },
          {
            key: 'brandsTechnologies',
            label: 'Hãng / công nghệ',
            value: draft.brandsTechnologies,
            suggestion: 'Thêm hãng / công nghệ đã làm.',
          },
          {
            key: 'technicalWorkTypes',
            label: 'Loại công việc kỹ thuật',
            value: draft.technicalWorkTypes,
            suggestion: 'Chọn loại nghiệp vụ kỹ thuật.',
          },
          {
            key: 'technicalAutonomyLevel',
            label: 'Mức tự chủ',
            value: draft.technicalAutonomyLevel,
            suggestion: 'Chọn mức tự chủ kỹ thuật (1–5).',
          },
          {
            key: 'troubleshootingLevel',
            label: 'Mức xử lý sự cố',
            value: draft.troubleshootingLevel,
            suggestion: 'Chọn mức xử lý sự cố (1–5).',
          },
          {
            key: 'technicalTools',
            label: 'Công cụ / phần mềm',
            value: draft.technicalTools,
            suggestion: 'Thêm phần mềm / công cụ kỹ thuật.',
          },
          {
            key: 'documentLiteracy',
            label: 'Đọc bản vẽ / tài liệu',
            value: draft.documentLiteracy,
            suggestion: 'Chọn khả năng đọc tài liệu kỹ thuật.',
          },
          {
            key: 'systemScaleNote',
            label: 'Quy mô hệ thống',
            value: draft.systemScaleNote,
            suggestion: 'Mô tả quy mô / công suất hệ thống.',
            weakIfShort: 10,
          },
          {
            key: 'shiftFlexibility',
            label: 'Làm ca / ngoài giờ',
            value: draft.shiftFlexibility,
            suggestion: 'Cho biết khả năng làm ca / ngoài giờ.',
          },
        ]
      : []),
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
      p?.careerObjective ||
      p?.currentPosition ||
      p?.phone ||
      p?.educationSchool ||
      (p?.hobbies?.length ?? 0) > 0 ||
      (p?.certificates?.length ?? 0) > 0 ||
      (p?.sales?.careerMotivations?.length ?? 0) > 0 ||
      p?.sales?.salesBehavior ||
      (p?.sales?.workStyles?.length ?? 0) > 0,
  );
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
  // Ưu tiên bản dài hơn / nhiều bullet hơn (CV pro hơn)
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

function mergeExperience(
  primary: CvDraft['experience'],
  fallback: CvDraft['experience'],
): CvDraft['experience'] {
  const used = new Set<number>();
  const out: CvDraft['experience'] = [];

  for (const pe of primary) {
    const key = normKey(pe.company);
    const fi = fallback.findIndex(
      (fe, idx) => !used.has(idx) && (normKey(fe.company) === key || normKey(fe.role) === normKey(pe.role)),
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
    if (used.has(idx)) return;
    out.push(fe);
  });

  return out.slice(0, 12);
}

function mergeEducation(
  primary: CvDraft['education'],
  fallback: CvDraft['education'],
): CvDraft['education'] {
  if (primary.length === 0) return fallback;
  if (fallback.length === 0) return primary;
  const used = new Set<number>();
  const out = primary.map((pe) => {
    const key = normKey(pe.school || pe.degree);
    const fi = fallback.findIndex((fe, i) => !used.has(i) && normKey(fe.school || fe.degree) === key);
    if (fi >= 0) used.add(fi);
    const fe = fi >= 0 ? fallback[fi] : null;
    return {
      school: pe.school || fe?.school || '',
      degree: pe.degree || fe?.degree || '',
      period: pe.period || fe?.period || '',
    };
  });
  fallback.forEach((fe, i) => {
    if (!used.has(i)) out.push(fe);
  });
  return out.slice(0, 8);
}

/**
 * Ghép bản nháp AI (upload CV) với hồ sơ nền tảng đã có
 * → CV hoàn chỉnh hơn CV gốc: giữ nội dung mới + bổ sung trường nền tảng còn thiếu.
 */
export function mergeCvDrafts(aiDraft: CvDraft, profileDraft: CvDraft): CvDraft {
  const experience = mergeExperience(aiDraft.experience, profileDraft.experience);
  const education = mergeEducation(aiDraft.education, profileDraft.education);

  return {
    ...profileDraft,
    ...aiDraft,
    fullName: aiDraft.fullName.trim() || profileDraft.fullName,
    title: aiDraft.title.trim() || profileDraft.title,
    email: aiDraft.email.trim() || profileDraft.email,
    phone: aiDraft.phone.trim() || profileDraft.phone,
    location: aiDraft.location.trim() || profileDraft.location,
    summary: pickRicherText(aiDraft.summary, profileDraft.summary),
    birthYear: aiDraft.birthYear ?? profileDraft.birthYear,
    birthDate: pickNonEmpty(aiDraft.birthDate, profileDraft.birthDate),
    district: null, // bỏ huyện khỏi CV draft
    ward: pickNonEmpty(aiDraft.ward, profileDraft.ward),
    educationLevel: pickNonEmpty(aiDraft.educationLevel, profileDraft.educationLevel),
    careerObjective: pickRicherText(aiDraft.careerObjective, profileDraft.careerObjective) || null,
    skills: unionList(aiDraft.skills, profileDraft.skills).slice(0, 24),
    softSkills: unionList(aiDraft.softSkills, profileDraft.softSkills).slice(0, 12),
    languages: unionList(aiDraft.languages, profileDraft.languages),
    hobbies: unionList(aiDraft.hobbies, profileDraft.hobbies),
    productsSold: unionList(aiDraft.productsSold, profileDraft.productsSold, ...experience.map((e) => e.productsSold)),
    customerSegments: unionList(
      aiDraft.customerSegments,
      profileDraft.customerSegments,
      ...experience.map((e) => e.customerSegments),
    ),
    marketsCovered: unionList(
      aiDraft.marketsCovered,
      profileDraft.marketsCovered,
      ...experience.map((e) => e.marketsCovered),
    ),
    industriesExperienced: unionList(
      aiDraft.industriesExperienced,
      profileDraft.industriesExperienced,
      ...experience.map((e) => e.industries),
    ),
    desiredPositions: unionList(aiDraft.desiredPositions, profileDraft.desiredPositions).slice(0, 3),
    desiredLocations: unionList(aiDraft.desiredLocations, profileDraft.desiredLocations),
    salesHighlights: toBulletText(
      pickRicherText(aiDraft.salesHighlights, profileDraft.salesHighlights),
    ),
    b2bExperienceBand: pickNonEmpty(aiDraft.b2bExperienceBand, profileDraft.b2bExperienceBand),
    newCustomerRatioPct: aiDraft.newCustomerRatioPct ?? profileDraft.newCustomerRatioPct,
    dealType: pickNonEmpty(aiDraft.dealType, profileDraft.dealType),
    typicalDealValue: aiDraft.typicalDealValue ?? profileDraft.typicalDealValue,
    maxDealValue: aiDraft.maxDealValue ?? profileDraft.maxDealValue,
    jobReadiness: pickNonEmpty(aiDraft.jobReadiness, profileDraft.jobReadiness),
    availabilityBand: pickNonEmpty(aiDraft.availabilityBand, profileDraft.availabilityBand),
    expectedSalaryMin: aiDraft.expectedSalaryMin ?? profileDraft.expectedSalaryMin,
    expectedSalaryMax: aiDraft.expectedSalaryMax ?? profileDraft.expectedSalaryMax,
    expectedOte: aiDraft.expectedOte ?? profileDraft.expectedOte,
    travelAbility: pickNonEmpty(aiDraft.travelAbility, profileDraft.travelAbility),
    hasB2License: aiDraft.hasB2License ?? profileDraft.hasB2License,
    driverLicenseType: pickNonEmpty(aiDraft.driverLicenseType, profileDraft.driverLicenseType),
    salesBehavior: pickNonEmpty(aiDraft.salesBehavior, profileDraft.salesBehavior),
    careerMotivations: unionList(aiDraft.careerMotivations, profileDraft.careerMotivations).slice(0, 3),
    careerOrientations: unionList(aiDraft.careerOrientations, profileDraft.careerOrientations),
    workStyles: unionList(aiDraft.workStyles, profileDraft.workStyles),
    jobTrack: pickNonEmpty(aiDraft.jobTrack, profileDraft.jobTrack),
    brandsTechnologies: unionList(aiDraft.brandsTechnologies, profileDraft.brandsTechnologies),
    technicalWorkTypes: unionList(aiDraft.technicalWorkTypes, profileDraft.technicalWorkTypes),
    technicalAutonomyLevel:
      aiDraft.technicalAutonomyLevel ?? profileDraft.technicalAutonomyLevel,
    troubleshootingLevel: aiDraft.troubleshootingLevel ?? profileDraft.troubleshootingLevel,
    technicalTools: unionList(aiDraft.technicalTools, profileDraft.technicalTools),
    documentLiteracy: unionList(aiDraft.documentLiteracy, profileDraft.documentLiteracy),
    systemScaleNote:
      pickRicherText(aiDraft.systemScaleNote, profileDraft.systemScaleNote) || null,
    shiftFlexibility: pickNonEmpty(aiDraft.shiftFlexibility, profileDraft.shiftFlexibility),
    experience,
    education,
    certificates: unionList(aiDraft.certificates, profileDraft.certificates),
    projects:
      aiDraft.projects.length > 0
        ? aiDraft.projects
        : profileDraft.projects,
  };
}
