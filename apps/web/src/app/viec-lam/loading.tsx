import { ListSkeleton } from '@/components/page-skeleton';

/**
 * /viec-lam dùng `AppShell wide flush allowGuest` → luôn render PublicHeader.
 * Ép chrome "public" cho khớp, tránh nhảy layout khi chuyển trang.
 */
export default function JobsListingLoading() {
  return <ListSkeleton tone="candidate" rows={6} chrome="public" />;
}
