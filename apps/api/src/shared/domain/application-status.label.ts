import { ApplicationStatus } from '@industriallink/contracts';

/** Nhãn tiếng Việt cho trạng thái hồ sơ ứng tuyển — dùng cho timeline, email, thông báo. */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  [ApplicationStatus.Applied]: 'Đã nộp',
  [ApplicationStatus.Screening]: 'Sàng lọc',
  [ApplicationStatus.Interview]: 'Phỏng vấn',
  [ApplicationStatus.Offer]: 'Đề nghị',
  [ApplicationStatus.Hired]: 'Trúng tuyển',
  [ApplicationStatus.Rejected]: 'Từ chối',
  [ApplicationStatus.Withdrawn]: 'Đã rút',
};

export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABEL[status] ?? status;
}
