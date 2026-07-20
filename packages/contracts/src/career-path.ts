/**
 * Lộ trình vị trí / cấp bậc B2B công nghiệp Việt Nam.
 * Dùng mã ổn định (code) trong DB/API; hiển thị bằng nhãn tiếng Việt.
 */

/** Khối chức năng nghề nghiệp. */
export enum JobTrack {
  Sales = 'sales',
  Technical = 'technical',
}

export const JOB_TRACK_LABEL: Record<JobTrack, string> = {
  [JobTrack.Sales]: 'Kinh doanh',
  [JobTrack.Technical]: 'Kỹ thuật',
};

/**
 * Mã cấp bậc theo từng khối.
 * Thứ tự trong CAREER_LADDERS phản ánh lộ trình thăng tiến thực tế.
 */
export enum JobLevelCode {
  // Kinh doanh
  SalesStaff = 'sales.staff',
  SalesTeamLead = 'sales.team_lead',
  SalesDeptHead = 'sales.dept_head',
  SalesDirector = 'sales.director',
  CompanyDirector = 'sales.company_director',

  // Kỹ thuật
  TechStaff = 'technical.staff',
  TechTeamLead = 'technical.team_lead',
  TechDeptHead = 'technical.dept_head',
  TechDirector = 'technical.director',
}

export const JOB_LEVEL_LABEL: Record<JobLevelCode, string> = {
  [JobLevelCode.SalesStaff]: 'Nhân viên Kinh doanh',
  [JobLevelCode.SalesTeamLead]: 'Trưởng nhóm Kinh doanh',
  [JobLevelCode.SalesDeptHead]: 'Trưởng phòng Kinh doanh',
  [JobLevelCode.SalesDirector]: 'Giám đốc Kinh doanh',
  [JobLevelCode.CompanyDirector]: 'Giám đốc công ty',

  [JobLevelCode.TechStaff]: 'Nhân viên Kỹ thuật',
  [JobLevelCode.TechTeamLead]: 'Trưởng nhóm Kỹ thuật',
  [JobLevelCode.TechDeptHead]: 'Trưởng phòng Kỹ thuật',
  [JobLevelCode.TechDirector]: 'Giám đốc Kỹ thuật',
};

/** Lộ trình thăng tiến theo từng khối (thứ tự từ thấp → cao). */
export const CAREER_LADDERS: Record<JobTrack, JobLevelCode[]> = {
  [JobTrack.Sales]: [
    JobLevelCode.SalesStaff,
    JobLevelCode.SalesTeamLead,
    JobLevelCode.SalesDeptHead,
    JobLevelCode.SalesDirector,
    JobLevelCode.CompanyDirector,
  ],
  [JobTrack.Technical]: [
    JobLevelCode.TechStaff,
    JobLevelCode.TechTeamLead,
    JobLevelCode.TechDeptHead,
    JobLevelCode.TechDirector,
  ],
};

/**
 * Khung lương tham chiếu thị trường B2B công nghiệp VN (VND/tháng).
 * Dùng cho Salary Engine (mock + baseline khi LLM thiếu số liệu).
 */
export const SALARY_BANDS_VND: Record<JobLevelCode, { min: number; max: number }> = {
  [JobLevelCode.SalesStaff]: { min: 10_000_000, max: 18_000_000 },
  [JobLevelCode.SalesTeamLead]: { min: 18_000_000, max: 28_000_000 },
  [JobLevelCode.SalesDeptHead]: { min: 28_000_000, max: 45_000_000 },
  [JobLevelCode.SalesDirector]: { min: 45_000_000, max: 80_000_000 },
  [JobLevelCode.CompanyDirector]: { min: 70_000_000, max: 150_000_000 },

  [JobLevelCode.TechStaff]: { min: 12_000_000, max: 22_000_000 },
  [JobLevelCode.TechTeamLead]: { min: 20_000_000, max: 32_000_000 },
  [JobLevelCode.TechDeptHead]: { min: 30_000_000, max: 50_000_000 },
  [JobLevelCode.TechDirector]: { min: 45_000_000, max: 85_000_000 },
};

export function isJobLevelCode(value: string | null | undefined): value is JobLevelCode {
  return Boolean(value && Object.values(JobLevelCode).includes(value as JobLevelCode));
}

export function trackOfLevel(code: JobLevelCode): JobTrack {
  return code.startsWith('technical.') ? JobTrack.Technical : JobTrack.Sales;
}

export function nextJobLevel(code: JobLevelCode): JobLevelCode | null {
  const ladder = CAREER_LADDERS[trackOfLevel(code)];
  const idx = ladder.indexOf(code);
  if (idx < 0 || idx >= ladder.length - 1) return null;
  return ladder[idx + 1];
}

export function salaryBand(code: JobLevelCode): { min: number; max: number; median: number } {
  const band = SALARY_BANDS_VND[code];
  return { ...band, median: Math.round((band.min + band.max) / 2) };
}

/** Nhãn hiển thị: ưu tiên taxonomy VN, còn lại chuẩn hoá free-text tiếng Anh phổ biến. */
export function formatJobLevel(value: string | null | undefined): string {
  if (!value) return '—';
  if (isJobLevelCode(value)) return JOB_LEVEL_LABEL[value];
  const seniority = SENIORITY_LABEL_VI[value.trim().toLowerCase()];
  if (seniority) return seniority;
  return formatJobTitle(value);
}

export function formatJobTrack(value: JobTrack | string | null | undefined): string {
  if (!value) return '—';
  if (value === JobTrack.Sales || value === JobTrack.Technical) {
    return JOB_TRACK_LABEL[value];
  }
  return value;
}

/** Cấp bậc free-text tiếng Anh → tiếng Việt chuyên môn. */
const SENIORITY_LABEL_VI: Readonly<Record<string, string>> = {
  junior: 'Sơ cấp',
  fresher: 'Mới tốt nghiệp',
  entry: 'Mới vào nghề',
  'entry-level': 'Mới vào nghề',
  middle: 'Trung cấp',
  mid: 'Trung cấp',
  'mid-level': 'Trung cấp',
  'mid level': 'Trung cấp',
  senior: 'Cấp cao',
  lead: 'Trưởng nhóm',
  principal: 'Chuyên gia cấp cao',
  intern: 'Thực tập',
  internship: 'Thực tập',
};

/** Cụm chức danh tiếng Anh phổ biến → tiếng Việt (thay thế theo thứ tự). */
const JOB_TITLE_PHRASES_VI: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bsales engineer\b/gi, 'Kỹ sư kinh doanh'],
  [/\btechnical sales\b/gi, 'Kinh doanh kỹ thuật'],
  [/\bservice engineer\b/gi, 'Kỹ sư dịch vụ'],
  [/\bapplication engineer\b/gi, 'Kỹ sư ứng dụng'],
  [/\bproject engineer\b/gi, 'Kỹ sư dự án'],
  [/\bautomation engineer\b/gi, 'Kỹ sư tự động hóa'],
  [/\bmechanical engineer\b/gi, 'Kỹ sư cơ khí'],
  [/\belectrical engineer\b/gi, 'Kỹ sư điện'],
  [/\bhvac engineer\b/gi, 'Kỹ sư điều hòa / HVAC'],
  [/\bdesign engineer\b/gi, 'Kỹ sư thiết kế'],
  [/\bsite engineer\b/gi, 'Kỹ sư hiện trường'],
  [/\blogistics engineer\b/gi, 'Kỹ sư kho vận'],
  [/\bplc engineer\b/gi, 'Kỹ sư PLC'],
  [/\bproject manager\b/gi, 'Quản lý dự án'],
  [/\bsales manager\b/gi, 'Quản lý kinh doanh'],
  [/\bsales executive\b/gi, 'Nhân viên kinh doanh'],
  [/\bproject sales\b/gi, 'Kinh doanh dự án'],
  [/\bkey account\b/gi, 'Chuyên viên khách hàng lớn'],
  [/\bsales b2b\b/gi, 'Kinh doanh B2B'],
  [/\btech lead\b/gi, 'Trưởng nhóm kỹ thuật'],
];

/**
 * Chuẩn hoá chức danh / vị trí hiển thị trên UX (Sales Engineer, Middle… → tiếng Việt).
 */
export function formatJobTitle(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();
  if (isJobLevelCode(trimmed)) return JOB_LEVEL_LABEL[trimmed];

  const seniorityExact = SENIORITY_LABEL_VI[trimmed.toLowerCase()];
  if (seniorityExact) return seniorityExact;

  let out = trimmed;
  for (const [pattern, vi] of JOB_TITLE_PHRASES_VI) {
    out = out.replace(pattern, vi);
  }
  out = out.replace(
    /\b(junior|fresher|entry-level|entry|middle|mid-level|mid|senior|lead|principal|intern|internship)\b/gi,
    (match) => SENIORITY_LABEL_VI[match.toLowerCase()] ?? match,
  );
  return out;
}

/**
 * Suy cấp bậc từ hồ sơ / chức danh (hỗ trợ mã chuẩn + free-text tiếng Việt/Anh).
 */
export function resolveJobLevel(input: {
  jobLevel?: string | null;
  currentPosition?: string | null;
  industry?: string | null;
  trackHint?: JobTrack | null;
}): JobLevelCode {
  if (isJobLevelCode(input.jobLevel)) return input.jobLevel;

  const text = `${input.jobLevel ?? ''} ${input.currentPosition ?? ''} ${input.industry ?? ''}`.toLowerCase();
  const salesHint =
    input.trackHint === JobTrack.Sales ||
    /kinh doanh|sales|account|bdm|business development/.test(text);

  if (/giám đốc công ty|ceo|tổng giám đốc|general director/.test(text)) {
    return JobLevelCode.CompanyDirector;
  }
  if (/giám đốc kinh doanh|sales director/.test(text)) return JobLevelCode.SalesDirector;
  if (/giám đốc kỹ thuật|technical director|cto/.test(text)) return JobLevelCode.TechDirector;
  if (/trưởng phòng kinh doanh/.test(text)) return JobLevelCode.SalesDeptHead;
  if (/trưởng phòng kỹ thuật|trưởng phòng/.test(text)) {
    return salesHint ? JobLevelCode.SalesDeptHead : JobLevelCode.TechDeptHead;
  }
  if (/trưởng nhóm kinh doanh|team lead.*sales|sales.*lead/.test(text)) {
    return JobLevelCode.SalesTeamLead;
  }
  if (/trưởng nhóm|team lead|supervisor/.test(text)) {
    return salesHint ? JobLevelCode.SalesTeamLead : JobLevelCode.TechTeamLead;
  }
  if (/senior|lead|manager/.test(text) && salesHint) return JobLevelCode.SalesTeamLead;
  if (/senior|lead|manager/.test(text)) return JobLevelCode.TechTeamLead;
  if (salesHint || /kinh doanh|sales/.test(text)) return JobLevelCode.SalesStaff;
  return JobLevelCode.TechStaff;
}

/** Tất cả lựa chọn để render select (có thể nhóm theo track). */
export function listJobLevelOptions(): {
  track: JobTrack;
  trackLabel: string;
  code: JobLevelCode;
  label: string;
}[] {
  return (Object.values(JobTrack) as JobTrack[]).flatMap((track) =>
    CAREER_LADDERS[track].map((code) => ({
      track,
      trackLabel: JOB_TRACK_LABEL[track],
      code,
      label: JOB_LEVEL_LABEL[code],
    })),
  );
}
