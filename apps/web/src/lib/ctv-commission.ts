import type {
  CtvCommissionPolicyPublicView,
  CtvMonthlyTierView,
} from '@industriallink/contracts';
import { apiRequest } from '@/lib/api';

/**
 * Bậc hoa hồng tháng này + thanh tiến độ lên hạng của CTV đang đăng nhập.
 * `yearMonth` dạng YYYY-MM. Bỏ trống = tháng hiện tại.
 */
export function fetchMyCommissionTier(yearMonth?: string): Promise<CtvMonthlyTierView> {
  const query = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : '';
  return apiRequest<CtvMonthlyTierView>(`/recruiter/partner/commission-tier${query}`);
}

/** Chính sách hoa hồng đang áp dụng (read-only cho CTV). */
export function fetchMyCommissionPolicy(): Promise<CtvCommissionPolicyPublicView | null> {
  return apiRequest<CtvCommissionPolicyPublicView | null>('/recruiter/partner/commission-policy');
}
