import type { CvDraftFieldHint, CvDraftView } from '@industriallink/contracts';
import type { ParsedResume, ParsedResumeExperience } from '../ai/domain/types';

function pickEmail(text: string): string {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0] ?? '';
}

function pickPhone(text: string): string {
  const m = text.match(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/);
  return m?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

function pickName(text: string, fallback: string): string {
  const patterns = [
    /(?:tôi(?:\s+tên)?|tên(?:\s+tôi)?|họ\s*và\s*tên)\s*[:\-]?\s*([A-ZÀ-Ỵ][\p{L}'’]+(?:\s+[A-ZÀ-Ỵ][\p{L}'’]+){1,4})/iu,
    /^([A-ZÀ-Ỵ][\p{L}'’]+(?:\s+[A-ZÀ-Ỵ][\p{L}'’]+){1,3})\s*[,.\n]/mu,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m[1].length >= 5) return m[1].trim();
  }
  return fallback;
}

function pickLocation(text: string): string {
  const m = text.match(/(?:tại|ở|sống tại|địa chỉ)\s+([^\n,.]{3,40})/i);
  if (m?.[1]) return m[1].trim();
  if (/hà nội|ha noi/i.test(text)) return 'Hà Nội';
  if (/hồ chí minh|tp\.?\s*hcm|sài gòn/i.test(text)) return 'TP. Hồ Chí Minh';
  if (/đà nẵng|da nang/i.test(text)) return 'Đà Nẵng';
  if (/việt nam|vietnam/i.test(text)) return 'Việt Nam';
  return '';
}

function experiencePeriod(exp: ParsedResumeExperience): string {
  const start = exp.startYear != null ? String(exp.startYear) : '';
  const end = exp.isCurrent ? 'Hiện tại' : exp.endYear != null ? String(exp.endYear) : '';
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

function mapParsedExperience(
  exp: ParsedResumeExperience,
  fallbackTitle: string,
): CvDraftView['experience'][number] {
  return {
    role: exp.jobTitle?.trim() || fallbackTitle || 'Sales',
    company: exp.companyName?.trim() || 'Công ty',
    period: experiencePeriod(exp),
    bullets: (exp.highlights ?? '').trim(),
    industries: exp.industries ?? [],
    productsSold: exp.productsSold ?? [],
    customerSegments: exp.customerSegments ?? [],
    marketsCovered: exp.marketsCovered ?? [],
    sellingStages: [],
    latestRevenue: null,
    kpiAchievementPct: null,
    newCustomerRatioPct: null,
    dealType: null,
    typicalDealValue: null,
    maxDealValue: null,
  };
}

function pickExperienceHeuristic(
  text: string,
  title: string,
): CvDraftView['experience'] {
  const company =
    text.match(
      /(?:công ty|cty|nhà máy|factory|tại)\s+([A-ZÀ-Ỵ0-9][\p{L}0-9 &.'-]{2,50})/iu,
    )?.[1]?.trim() ?? '';
  const years = text.match(/(\d+)\s*(?:năm|year)/i)?.[1];
  const period = years
    ? `${new Date().getFullYear() - Number(years)} – Hiện tại`
    : '';
  const hasExp = Boolean(company || years || /kinh nghiệm|làm việc|bán hàng|sales/i.test(text));
  if (!hasExp) return [];
  return [
    {
      role: title || 'Nhân viên kinh doanh',
      company: company || 'Chưa rõ công ty',
      period: period || 'Chưa rõ thời gian',
      bullets: text
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 25 &&
            /bán hàng|doanh số|khách hàng|kpi|vận hành|bảo trì|tối ưu|phụ trách|thành thạo|triển khai/i.test(
              s,
            ),
        )
        .slice(0, 4)
        .join('\n') || text.slice(0, 280).trim(),
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
    },
  ];
}

function pickEducation(text: string, parsed: ParsedResume): CvDraftView['education'] {
  if (parsed.specialization && /đại học|học viện|cao đẳng/i.test(text)) {
    const school =
      text.match(/((?:đại học|học viện|cao đẳng|trường)[\p{L}\s.]{2,60})/iu)?.[1]?.trim() ??
      '';
    return [
      {
        school: school || 'Chưa rõ trường',
        degree: parsed.specialization,
        period: '',
      },
    ];
  }
  const school =
    text.match(/((?:đại học|học viện|cao đẳng|trường)[\p{L}\s.]{2,60})/iu)?.[1]?.trim() ?? '';
  const year = text.match(/(20\d{2})\s*(?:[-–—]\s*(20\d{2}|nay|hiện tại))?/i);
  if (!school && !/tốt nghiệp|học vấn|cử nhân|kỹ sư/i.test(text)) return [];
  return [
    {
      school: school || 'Chưa rõ trường',
      degree: /kỹ sư|cử nhân|thạc sĩ/i.exec(text)?.[0] ?? 'Chưa rõ ngành',
      period: year ? year[0].replace(/\s+/g, ' ') : '',
    },
  ];
}

function pickCertificates(text: string): string[] {
  const found: string[] = [];
  if (/iso\s*9001/i.test(text)) found.push('ISO 9001');
  if (/an toàn|atld|osh/i.test(text)) found.push('An toàn lao động');
  if (/toeic|ielts/i.test(text)) found.push(/toeic|ielts/i.exec(text)?.[0]?.toUpperCase() ?? 'Ngoại ngữ');
  if (/bằng\s*b2|giấy phép.*b2/i.test(text)) found.push('Bằng lái B2');
  return found;
}

function pickLanguages(text: string): string[] {
  const out: string[] = [];
  if (/tiếng anh|english|toeic|ielts/i.test(text)) out.push('Tiếng Anh');
  if (/tiếng trung|chinese|hsk/i.test(text)) out.push('Tiếng Trung');
  if (/tiếng nhật|japanese|jlpt/i.test(text)) out.push('Tiếng Nhật');
  if (/tiếng hàn|korean|topik/i.test(text)) out.push('Tiếng Hàn');
  return out;
}

function pickProjects(text: string): CvDraftView['projects'] {
  const m = text.match(/(?:dự án|project)\s*[:\-]?\s*([^\n.]{8,120})/i);
  if (!m?.[1]) return [];
  return [{ name: m[1].trim(), detail: 'Được trích từ mô tả của ứng viên.' }];
}

function union(...lists: string[][]): string[] {
  return [...new Set(lists.flat().map((x) => x.trim()).filter(Boolean))];
}

function field(
  key: string,
  label: string,
  value: string | null | undefined,
  suggestion: string,
  weakIf?: (v: string) => boolean,
): CvDraftFieldHint {
  const v = (value ?? '').trim();
  if (!v || v.startsWith('Chưa rõ')) {
    return { key, label, status: 'missing', value: v || null, suggestion };
  }
  if (weakIf?.(v)) {
    return { key, label, status: 'weak', value: v, suggestion };
  }
  return { key, label, status: 'filled', value: v, suggestion };
}

/** Ghép kết quả AI parse (ưu tiên experiences Sales B2B) + heuristic → bản nháp CV. */
export function buildCvDraftFromText(opts: {
  text: string;
  parsed: ParsedResume;
  fallbackName: string;
  fallbackEmail: string;
}): { draft: CvDraftView; fields: CvDraftFieldHint[] } {
  const { text, parsed, fallbackName, fallbackEmail } = opts;
  const email = pickEmail(text) || fallbackEmail;
  const phone = pickPhone(text);
  const fullName = pickName(text, fallbackName);
  const location = pickLocation(text);
  const title = parsed.currentPosition?.trim() || '';
  const skills = parsed.skills.map((s) => s.name).slice(0, 16);
  const softSkills = parsed.strengths.slice(0, 8);
  const languages = pickLanguages(text);

  const experience =
    parsed.experiences?.length > 0
      ? parsed.experiences.map((e) => mapParsedExperience(e, title))
      : pickExperienceHeuristic(text, title);

  const productsSold = union(...experience.map((e) => e.productsSold));
  const customerSegments = union(...experience.map((e) => e.customerSegments));
  const marketsCovered = union(...experience.map((e) => e.marketsCovered));

  const education = pickEducation(text, parsed);
  const certificates = pickCertificates(text);
  const projects = pickProjects(text);
  const summary = parsed.summary?.trim() || '';
  const salesHighlights = experience
    .map((e) => e.bullets)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');

  const draft: CvDraftView = {
    fullName,
    title,
    email,
    phone,
    location,
    summary,
    birthYear: null,
    educationLevel: null,
    skills,
    softSkills,
    languages,
    productsSold,
    customerSegments,
    marketsCovered,
    industriesExperienced: union(...experience.map((e) => e.industries)),
    desiredPositions: title ? [title] : [],
    desiredLocations: location ? [location] : [],
    salesHighlights,
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
    experience,
    education,
    certificates,
    projects,
  };

  const fields: CvDraftFieldHint[] = [
    field('fullName', 'Họ và tên', fullName, 'Thêm dòng: "Tôi tên ..."'),
    field('title', 'Vị trí / cấp bậc', title, 'Ghi rõ vị trí, ví dụ: Sales Engineer'),
    field('email', 'Email', email, 'Thêm email liên hệ'),
    field('phone', 'Số điện thoại', phone, 'Thêm SĐT (vd: 0901 234 567)'),
    field('location', 'Địa điểm', location, 'Ghi nơi ở / sẵn sàng làm việc'),
    field(
      'summary',
      'Giới thiệu bản thân',
      summary,
      'Mô tả ngắn 3–5 câu về thế mạnh và định hướng',
      (v) => v.length < 60,
    ),
    field(
      'skills',
      'Kỹ năng chuyên môn',
      skills.join(', '),
      'Liệt kê kỹ năng (sản phẩm, bán hàng, kỹ thuật...)',
      (v) => v.split(',').filter(Boolean).length < 2,
    ),
    field(
      'experience',
      'Kinh nghiệm công ty',
      experience.map((e) => e.company).join(', '),
      'Ghi công ty, vị trí, sản phẩm và tệp khách hàng',
    ),
    field(
      'products',
      'Sản phẩm bán',
      productsSold.join(', '),
      'Bổ sung sản phẩm / giải pháp đã bán',
    ),
    field(
      'segments',
      'Tệp khách hàng',
      customerSegments.join(', '),
      'Bổ sung phân khúc KH (FDI, SME...)',
    ),
    field(
      'markets',
      'Thị trường',
      marketsCovered.join(', '),
      'Bổ sung khu vực phụ trách',
    ),
    field(
      'education',
      'Học vấn',
      education[0] ? `${education[0].school} — ${education[0].degree}` : '',
      'Ghi trường, ngành và năm tốt nghiệp',
    ),
    field(
      'certificates',
      'Chứng chỉ',
      certificates.join(', '),
      'Thêm chứng chỉ nếu có',
    ),
    field(
      'languages',
      'Ngoại ngữ',
      languages.join(', '),
      'Thêm ngoại ngữ (Tiếng Anh...)',
    ),
  ];

  return { draft, fields };
}
