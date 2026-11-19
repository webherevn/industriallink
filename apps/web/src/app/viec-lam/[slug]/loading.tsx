import { PageSkeleton } from '@/components/page-skeleton';

/**
 * Trang chi tiết việc làm dùng `AppShell wide allowGuest` → luôn render PublicHeader.
 */
export default function JobDetailLoading() {
  return <PageSkeleton tone="candidate" cards={2} chrome="public" />;
}
