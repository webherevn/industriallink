import {
  ApplicationStatus,
  EmploymentType,
  ExperienceBand,
  formatJobLevel,
  formatJobTitle,
  formatJobTrack,
} from '@industriallink/contracts';

export { formatJobLevel, formatJobTitle, formatJobTrack };

/** Format số tiền VND thông minh: tỷ / triệu / đ (không hiện "1000 triệu"). */
export function formatVndAmount(n: number): string {
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
        : tr.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${text} triệu`;
  }
  if (abs >= 1_000) {
    return `${Math.round(n).toLocaleString('vi-VN')} đ`;
  }
  return `${n.toLocaleString('vi-VN')} đ`;
}

/** Lương / khoảng tiền: min=max → một giá trị; ≥1 tỷ dùng đơn vị tỷ. */
export function formatSalary(min: number | null, max: number | null): string {
  if (min != null && max != null) {
    if (min === max) return formatVndAmount(min);
    return `${formatVndAmount(min)} – ${formatVndAmount(max)}`;
  }
  if (min != null) return `Từ ${formatVndAmount(min)}`;
  if (max != null) return `Đến ${formatVndAmount(max)}`;
  return 'Thoả thuận';
}

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  [EmploymentType.FullTime]: 'Toàn thời gian',
  [EmploymentType.PartTime]: 'Bán thời gian',
  [EmploymentType.Contract]: 'Hợp đồng',
  [EmploymentType.Internship]: 'Thực tập',
  [EmploymentType.Seasonal]: 'Thời vụ',
};

export const EXPERIENCE_LABEL: Record<ExperienceBand, string> = {
  [ExperienceBand.None]: 'Không yêu cầu',
  [ExperienceBand.Under1]: 'Dưới 1 năm',
  [ExperienceBand.From1To3]: '1–3 năm',
  [ExperienceBand.From3To5]: '3–5 năm',
  [ExperienceBand.Over5]: 'Trên 5 năm',
};

export const INTERVIEW_TYPE_LABEL: Record<string, string> = {
  hr: 'Phỏng vấn HR',
  technical: 'PV Chuyên môn',
  other: 'Phỏng vấn khác',
};

export const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Đã lên lịch',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  no_show: 'Không đến',
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ phản hồi',
  accepted: 'Đã chấp nhận',
  declined: 'Đã từ chối',
  withdrawn: 'Đã rút',
  expired: 'Hết hạn',
};

export const ONBOARDING_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ nhận việc',
  in_progress: 'Đang nhận việc',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Applied]: 'Đã ứng tuyển',
  [ApplicationStatus.Screening]: 'Sàng lọc hồ sơ',
  [ApplicationStatus.Interview]: 'Phỏng vấn',
  [ApplicationStatus.Offer]: 'Đề nghị làm việc',
  [ApplicationStatus.Hired]: 'Đã nhận việc',
  [ApplicationStatus.Rejected]: 'Đã từ chối',
  [ApplicationStatus.Withdrawn]: 'Đã rút',
};

export function statusTone(
  status: ApplicationStatus,
): 'brand' | 'slate' | 'green' | 'amber' | 'red' {
  switch (status) {
    case ApplicationStatus.Hired:
      return 'green';
    case ApplicationStatus.Offer:
    case ApplicationStatus.Interview:
      return 'amber';
    case ApplicationStatus.Rejected:
    case ApplicationStatus.Withdrawn:
      return 'red';
    case ApplicationStatus.Applied:
      return 'brand';
    default:
      return 'slate';
  }
}

/** Thứ tự các bước trong pipeline để nhà tuyển dụng chuyển trạng thái. */
export const PIPELINE_STEPS: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.Screening,
  ApplicationStatus.Interview,
  ApplicationStatus.Offer,
  ApplicationStatus.Hired,
];
