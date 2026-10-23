import {
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  salaryBand,
  trackOfLevel,
  type SalaryEstimateView,
} from '@industriallink/contracts';

export interface SalaryEstimateEngineInput {
  jobLevel: JobLevelCode;
  industry?: string;
  location?: string;
  title?: string;
  yearsOfExperience?: number;
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
