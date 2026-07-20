import {
  CAREER_LADDERS,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
  nextJobLevel,
  resolveJobLevel,
  salaryBand,
  trackOfLevel,
  type CareerAdviceView,
  type CareerLadderStepView,
  type SalaryEstimateView,
} from '@industriallink/contracts';

export interface CareerAdviceEngineInput {
  track?: JobTrack;
  currentLevel?: JobLevelCode;
  jobLevel?: string | null;
  currentPosition?: string | null;
  industry?: string | null;
  skills?: string[];
  yearsOfExperience?: number | null;
  strengths?: string[];
  weaknesses?: string[];
}

export interface SalaryEstimateEngineInput {
  jobLevel: JobLevelCode;
  industry?: string;
  location?: string;
  title?: string;
  yearsOfExperience?: number;
}

/** Career Engine: lộ trình + mức sẵn sàng + khung lương theo taxonomy VN. */
export function buildCareerAdvice(input: CareerAdviceEngineInput): CareerAdviceView {
  const currentLevel =
    input.currentLevel ??
    resolveJobLevel({
      jobLevel: input.jobLevel,
      currentPosition: input.currentPosition,
      industry: input.industry,
      trackHint: input.track,
    });

  const track = input.track ?? trackOfLevel(currentLevel);
  // Nếu user chọn track khác với level suy ra, map sang cấp tương đương trên ladder đó.
  const levelOnTrack = alignLevelToTrack(currentLevel, track);
  const ladderCodes = CAREER_LADDERS[track];
  const idx = ladderCodes.indexOf(levelOnTrack);
  const next = nextJobLevel(levelOnTrack);

  const ladder: CareerLadderStepView[] = ladderCodes.map((code, i) => ({
    code,
    label: JOB_LEVEL_LABEL[code],
    status:
      i < idx ? 'past' : i === idx ? 'current' : i === idx + 1 ? 'next' : 'future',
  }));

  const skills = input.skills ?? [];
  const years = input.yearsOfExperience ?? null;
  const readiness = computeReadiness(levelOnTrack, years, skills.length, input.weaknesses?.length ?? 0);
  const skillGaps = buildSkillGaps(track, levelOnTrack, skills);
  const actionPlan = buildActionPlan(track, levelOnTrack, next, skillGaps, years);
  const salaryCurrent = toBandView(salaryBand(levelOnTrack));
  const salaryNext = next ? toBandView(salaryBand(next)) : null;

  const summary = next
    ? `Bạn đang ở bậc «${JOB_LEVEL_LABEL[levelOnTrack]}» (khối ${JOB_TRACK_LABEL[track]}). Bậc tiếp theo là «${JOB_LEVEL_LABEL[next]}» — mức sẵn sàng khoảng ${readiness}%. Khung lương hiện tại khoảng ${(salaryCurrent.min / 1e6).toFixed(0)}–${(salaryCurrent.max / 1e6).toFixed(0)} triệu VND/tháng.`
    : `Bạn đang ở bậc cao nhất của khối ${JOB_TRACK_LABEL[track]} («${JOB_LEVEL_LABEL[levelOnTrack]}»). Tập trung mở rộng ảnh hưởng tổ chức và mentoring đội ngũ.`;

  return {
    track,
    trackLabel: JOB_TRACK_LABEL[track],
    currentLevel: levelOnTrack,
    currentLevelLabel: JOB_LEVEL_LABEL[levelOnTrack],
    nextLevel: next,
    nextLevelLabel: next ? JOB_LEVEL_LABEL[next] : null,
    ladder,
    readinessScore: readiness,
    skillGaps,
    actionPlan,
    summary,
    salaryCurrent,
    salaryNext,
    confidence: 0.75,
  };
}

/** Salary Engine: ước lương theo cấp bậc VN + điều chỉnh ngành/địa điểm/kinh nghiệm. */
export function buildSalaryEstimate(input: SalaryEstimateEngineInput): SalaryEstimateView {
  const track = trackOfLevel(input.jobLevel);
  const base = salaryBand(input.jobLevel);
  let min = base.min;
  let max = base.max;
  const factors: string[] = [`Cấp bậc: ${JOB_LEVEL_LABEL[input.jobLevel]}`];

  const industry = input.industry?.toLowerCase() ?? '';
  if (/automation|tự động|plc|scada|robot/.test(industry)) {
    min = Math.round(min * 1.05);
    max = Math.round(max * 1.08);
    factors.push('Ngành tự động hoá / thiết bị công nghiệp (premium nhẹ)');
  } else if (/sales|kinh doanh/.test(industry)) {
    factors.push('Khối kinh doanh B2B — lương cứng + thưởng doanh số (chưa gồm KPI)');
  }

  const location = input.location?.toLowerCase() ?? '';
  if (/hcm|hồ chí minh|sài gòn|hà nội|ha noi/.test(location)) {
    min = Math.round(min * 1.08);
    max = Math.round(max * 1.1);
    factors.push('Địa bàn thành phố lớn (HCM/Hà Nội)');
  } else if (/đồng nai|dong nai|bình dương|binh duong|bắc ninh|hai phong|hải phòng/.test(location)) {
    factors.push('KCN vệ tinh — mức trung bình thị trường công nghiệp');
  }

  if (input.yearsOfExperience != null) {
    if (input.yearsOfExperience >= 10) {
      min = Math.round(min * 1.06);
      max = Math.round(max * 1.1);
      factors.push(`Kinh nghiệm ${input.yearsOfExperience} năm — thiên về cận trên khung`);
    } else if (input.yearsOfExperience <= 1) {
      min = Math.round(min * 0.9);
      max = Math.round(max * 0.95);
      factors.push('Kinh nghiệm còn mỏng — thiên về cận dưới khung');
    } else {
      factors.push(`Kinh nghiệm ${input.yearsOfExperience} năm`);
    }
  }

  if (input.title?.trim()) {
    factors.push(`Tham chiếu chức danh: ${input.title.trim()}`);
  }

  const median = Math.round((min + max) / 2);
  return {
    jobLevel: input.jobLevel,
    jobLevelLabel: JOB_LEVEL_LABEL[input.jobLevel],
    track,
    trackLabel: JOB_TRACK_LABEL[track],
    salaryMin: min,
    salaryMax: max,
    median,
    currency: 'VND',
    factors,
    notes:
      'Khung tham chiếu thị trường B2B công nghiệp Việt Nam (lương cứng/tháng). Thưởng KPI, phụ cấp, gross/net có thể khác theo công ty.',
    confidence: 0.7,
  };
}

function toBandView(band: { min: number; max: number; median: number }) {
  return { min: band.min, max: band.max, median: band.median, currency: 'VND' as const };
}

function alignLevelToTrack(level: JobLevelCode, track: JobTrack): JobLevelCode {
  if (trackOfLevel(level) === track) return level;
  const from = CAREER_LADDERS[trackOfLevel(level)];
  const to = CAREER_LADDERS[track];
  const idx = Math.min(Math.max(from.indexOf(level), 0), to.length - 1);
  return to[idx];
}

function computeReadiness(
  level: JobLevelCode,
  years: number | null,
  skillCount: number,
  weaknessCount: number,
): number {
  let score = 55;
  const expectedYears: Partial<Record<JobLevelCode, number>> = {
    [JobLevelCode.SalesStaff]: 1,
    [JobLevelCode.TechStaff]: 1,
    [JobLevelCode.SalesTeamLead]: 3,
    [JobLevelCode.TechTeamLead]: 3,
    [JobLevelCode.SalesDeptHead]: 6,
    [JobLevelCode.TechDeptHead]: 6,
    [JobLevelCode.SalesDirector]: 10,
    [JobLevelCode.TechDirector]: 10,
    [JobLevelCode.CompanyDirector]: 12,
  };
  const need = expectedYears[level] ?? 3;
  if (years != null) {
    if (years >= need + 2) score += 20;
    else if (years >= need) score += 12;
    else if (years >= need - 1) score += 5;
    else score -= 8;
  }
  score += Math.min(15, skillCount * 2);
  score -= Math.min(12, weaknessCount * 4);
  return Math.max(15, Math.min(95, Math.round(score)));
}

function buildSkillGaps(track: JobTrack, level: JobLevelCode, have: string[]): string[] {
  const haveNorm = new Set(have.map((s) => s.toLowerCase()));
  const suggested =
    track === JobTrack.Sales
      ? suggestedSalesSkills(level)
      : suggestedTechSkills(level);
  return suggested.filter((s) => !haveNorm.has(s.toLowerCase())).slice(0, 5);
}

function suggestedSalesSkills(level: JobLevelCode): string[] {
  const base = ['Tư vấn giải pháp', 'Quản lý pipeline CRM', 'Đàm phán hợp đồng B2B'];
  if (
    level === JobLevelCode.SalesTeamLead ||
    level === JobLevelCode.SalesDeptHead ||
    level === JobLevelCode.SalesDirector ||
    level === JobLevelCode.CompanyDirector
  ) {
    return [...base, 'Quản lý đội sales', 'Dự báo doanh số', 'Phát triển kênh KCN'];
  }
  return [...base, 'Hiểu sản phẩm kỹ thuật cơ bản', 'Chăm sóc khách hàng nhà máy'];
}

function suggestedTechSkills(level: JobLevelCode): string[] {
  const base = ['PLC', 'SCADA', 'Đọc bản vẽ điện', 'ATLĐ nhà máy'];
  if (
    level === JobLevelCode.TechTeamLead ||
    level === JobLevelCode.TechDeptHead ||
    level === JobLevelCode.TechDirector
  ) {
    return [...base, 'Lập kế hoạch bảo trì', 'Quản lý dự án kỹ thuật', 'Đào tạo kỹ thuật viên'];
  }
  return [...base, 'TIA Portal', 'Xử lý sự cố dây chuyền'];
}

function buildActionPlan(
  track: JobTrack,
  current: JobLevelCode,
  next: JobLevelCode | null,
  gaps: string[],
  years: number | null,
): string[] {
  const plan: string[] = [];
  if (next) {
    plan.push(`Đặt mục tiêu thăng tiến lên «${JOB_LEVEL_LABEL[next]}» trong 12–24 tháng.`);
  } else {
    plan.push('Duy trì chuyên môn sâu và mở rộng vai trò cố vấn / lãnh đạo chiến lược.');
  }
  if (gaps.length > 0) {
    plan.push(`Bổ sung kỹ năng ưu tiên: ${gaps.slice(0, 3).join(', ')}.`);
  }
  if (track === JobTrack.Technical) {
    plan.push('Tích luỹ case study xử lý sự cố / dự án cải tiến OEE tại nhà máy.');
  } else {
    plan.push('Xây dựng pipeline khách hàng KCN và case chốt deal giải pháp công nghiệp.');
  }
  if (years != null && years < 3) {
    plan.push('Tăng thời gian thực chiến tại hiện trường (nhà máy / KCN) để củng cố uy tín.');
  }
  plan.push(
    `Đối chiếu khung lương bậc «${JOB_LEVEL_LABEL[current]}» khi đàm phán offer hoặc review lương.`,
  );
  return plan.slice(0, 6);
}
