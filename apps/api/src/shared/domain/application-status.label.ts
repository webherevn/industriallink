import { ApplicationStatus } from '@industriallink/contracts';

/**
 * Nhãn tiếng Việt cho trạng thái hồ sơ ứng tuyển — dùng cho timeline, email, thông báo.
 * Đồng bộ với bộ nhãn chuẩn ở web (`apps/web/src/lib/format.ts`).
 */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  [ApplicationStatus.Applied]: 'Mới ứng tuyển',
  [ApplicationStatus.Screening]: 'Sàng lọc',
  [ApplicationStatus.Interview]: 'Phỏng vấn',
  [ApplicationStatus.Offer]: 'Đề nghị',
  [ApplicationStatus.Hired]: 'Đã nhận việc',
  [ApplicationStatus.Rejected]: 'Đã từ chối',
  [ApplicationStatus.Withdrawn]: 'Đã rút',
};

export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABEL[status] ?? status;
}
