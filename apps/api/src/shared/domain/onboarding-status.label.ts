import { OnboardingStatus } from '@industriallink/contracts';

/** Nhãn tiếng Việt cho trạng thái nhận việc — dùng cho timeline, email, thông báo. */
export const ONBOARDING_STATUS_LABEL: Record<string, string> = {
  [OnboardingStatus.Pending]: 'Chờ nhận việc',
  [OnboardingStatus.InProgress]: 'Đang nhận việc',
  [OnboardingStatus.Completed]: 'Hoàn tất',
  [OnboardingStatus.Cancelled]: 'Đã huỷ',
};

export function onboardingStatusLabel(status: string): string {
  return ONBOARDING_STATUS_LABEL[status] ?? status;
}
