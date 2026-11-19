import { PageSkeleton } from '@/components/page-skeleton';

/**
 * Trang hồ sơ công khai dùng `AppShell bleed allowGuest` → luôn render PublicHeader.
 */
export default function CompanyProfileLoading() {
  return <PageSkeleton tone="candidate" cards={2} chrome="public" />;
}
