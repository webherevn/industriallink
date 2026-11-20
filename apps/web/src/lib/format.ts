import {
  ApplicationStatus,
  EmploymentType,
  ExperienceBand,
  formatJobLevel,
  formatJobTitle,
  formatJobTrack,
  type ApplicationSource,
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
  technical: 'Phỏng vấn chuyên môn',
  other: 'Phỏng vấn khác',
};

export function interviewMarkText(mark: { type: string; status: string }): string {
  const kind = INTERVIEW_TYPE_LABEL[mark.type] ?? mark.type;
  const state = INTERVIEW_STATUS_LABEL[mark.status] ?? mark.status;
  return `${kind} · ${state}`;
}

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

/**
 * Bộ tên trạng thái CHUẨN xuyên suốt ATS (Hộp thư ứng viên & Kanban Quy trình).
 * Không dùng lẫn `Đã ứng tuyển` với `Mới ứng tuyển`, hay `Sàng lọc` với `Sàng lọc hồ sơ`.
 */
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Applied]: 'Mới ứng tuyển',
  [ApplicationStatus.Screening]: 'Sàng lọc',
  [ApplicationStatus.Interview]: 'Phỏng vấn',
  [ApplicationStatus.Offer]: 'Đề nghị',
  [ApplicationStatus.Hired]: 'Đã nhận việc',
  [ApplicationStatus.Rejected]: 'Đã từ chối',
  [ApplicationStatus.Withdrawn]: 'Đã rút',
};

/** Nhãn nguồn hồ sơ ứng viên. */
export const APPLICATION_SOURCE_LABEL: Record<ApplicationSource, string> = {
  self_applied: 'Tự ứng tuyển',
  hunt: 'Tin săn nhân sự',
  ai_suggested: 'AI gợi ý',
};

/**
 * Chuẩn hóa tên người sang Title Case (VD: "NGUYEN VAN A" → "Nguyen Van A").
 * Giữ nguyên chữ có dấu tiếng Việt, không đụng tới họ tên đã viết đúng Title Case.
 */
export function toTitleCase(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      // Giữ dấu tiếng Việt khi đã đúng dạng lowercase có dấu.
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Thời gian tương đối: "2 ngày trước", "3 giờ trước", "vừa xong". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'vừa xong';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  return `${Math.floor(months / 12)} năm trước`;
}

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
