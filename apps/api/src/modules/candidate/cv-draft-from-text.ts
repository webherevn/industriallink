import type { CvDraftFieldHint, CvDraftView } from '@industriallink/contracts';
import type { ParsedResume } from '../ai/domain/types';

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
  const m = text.match(
    /(?:tại|ở|sống tại|địa chỉ)\s+([^\n,.]{3,40})/i,
  );
  if (m?.[1]) return m[1].trim();
  if (/hà nội|ha noi/i.test(text)) return 'Hà Nội';
  if (/hồ chí minh|tp\.?\s*hcm|sài gòn/i.test(text)) return 'TP. Hồ Chí Minh';
  if (/đà nẵng|da nang/i.test(text)) return 'Đà Nẵng';
  if (/việt nam|vietnam/i.test(text)) return 'Việt Nam';
  return '';
}

function pickExperience(
  text: string,
  title: string,
): CvDraftView['experience'] {
  const company =
    text.match(
      /(?:công ty|cty|nhà máy|factory|tại)\s+([A-ZÀ-Ỵ0-9][\p{L}0-9 &.'-]{2,50})/iu,
    )?.[1]?.trim() ?? '';
  const years = text.match(/(\d+)\s*(?:năm|year)/i)?.[1];
  const period = years ? `${new Date().getFullYear() - Number(years)} — Hiện tại` : '';
  const hasExp = Boolean(company || years || /kinh nghiệm|làm việc|vận hành/i.test(text));
  if (!hasExp) return [];
  return [
    {
      role: title || 'Nhân viên kỹ thuật',
      company: company || 'Chưa rõ công ty',
      period: period || 'Chưa rõ thời gian',
      bullets: text
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 25 && /vận hành|bảo trì|tối ưu|phụ trách|thành thạo|triển khai/i.test(s))
        .slice(0, 3)
        .join('\n') || text.slice(0, 220).trim(),
    },
  ];
}

function pickEducation(text: string): CvDraftView['education'] {
  const school =
    text.match(
      /((?:đại học|học viện|cao đẳng|trường)[\p{L}\s.]{2,60})/iu,
    )?.[1]?.trim() ?? '';
  const year = text.match(/(20\d{2})\s*(?:[-–—]\s*(20\d{2}|nay|hiện tại))?/i);
  if (!school && !/tốt nghiệp|học vấn|cử nhân|kỹ sư/i.test(text)) return [];
  return [
    {
      school: school || 'Chưa rõ trường',
      degree: /kỹ sư|cử nhân|thạc sĩ/i.exec(text)?.[0] ?? 'Chưa rõ ngành',
      period: year ? year[0].replace(/\s+/g, ' ') : 'Chưa rõ thời gian',
    },
  ];
}

function pickCertificates(text: string): string[] {
  const found: string[] = [];
  if (/iso\s*9001/i.test(text)) found.push('ISO 9001');
  if (/an toàn|atld|osh/i.test(text)) found.push('An toàn lao động');
  if (/toeic|ielts|tiếng anh/i.test(text)) found.push('Ngoại ngữ');
  return found;
}

function pickProjects(text: string): CvDraftView['projects'] {
  const m = text.match(
    /(?:dự án|project)\s*[:\-]?\s*([^\n.]{8,120})/i,
  );
  if (!m?.[1]) return [];
  return [{ name: m[1].trim(), detail: 'Được trích từ mô tả của ứng viên.' }];
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

/** Ghép kết quả AI parse + heuristic từ văn bản tự do → bản nháp CV + gợi ý thiếu. */
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
  const skills = parsed.skills.map((s) => s.name).slice(0, 8);
  const softSkills = parsed.strengths.slice(0, 5);
  const experience = pickExperience(text, title);
  const education = pickEducation(text);
  const certificates = pickCertificates(text);
  const projects = pickProjects(text);
  const summary = parsed.summary?.trim() || '';

  const draft: CvDraftView = {
    fullName,
    title,
    email,
    phone,
    location,
    summary,
    skills,
    softSkills,
    experience,
    education,
    certificates,
    projects,
  };

  const fields: CvDraftFieldHint[] = [
    field('fullName', 'Họ và tên', fullName, 'Thêm dòng: "Tôi tên ..."'),
    field('title', 'Vị trí / cấp bậc', title, 'Ghi rõ vị trí mong muốn, ví dụ: Kỹ sư PLC'),
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
      'Liệt kê kỹ năng công nghiệp (PLC, SCADA, Lean...)',
      (v) => v.split(',').filter(Boolean).length < 2,
    ),
    field(
      'experience',
      'Kinh nghiệm làm việc',
      experience[0] ? `${experience[0].role} @ ${experience[0].company}` : '',
      'Ghi công ty, số năm và việc đã làm',
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
      'Thêm chứng chỉ (ISO, an toàn, ngoại ngữ...) nếu có',
    ),
    field(
      'projects',
      'Dự án tiêu biểu',
      projects[0]?.name ?? '',
      'Mô tả 1–2 dự án nổi bật bạn đã tham gia',
    ),
  ];

  return { draft, fields };
}
