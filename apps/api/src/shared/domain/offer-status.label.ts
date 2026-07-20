import { OfferStatus } from '@industriallink/contracts';

/** Nhãn tiếng Việt cho trạng thái offer — dùng cho timeline, email, thông báo. */
export const OFFER_STATUS_LABEL: Record<string, string> = {
  [OfferStatus.Pending]: 'Chờ phản hồi',
  [OfferStatus.Accepted]: 'Đã chấp nhận',
  [OfferStatus.Declined]: 'Đã từ chối',
  [OfferStatus.Withdrawn]: 'Đã rút',
  [OfferStatus.Expired]: 'Hết hạn',
};

export function offerStatusLabel(status: string): string {
  return OFFER_STATUS_LABEL[status] ?? status;
}
