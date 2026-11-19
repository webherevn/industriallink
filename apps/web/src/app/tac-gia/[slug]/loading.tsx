import { PageSkeleton } from '@/components/page-skeleton';

/** Trang tác giả dùng `AppShell allowGuest flush bleed` → PublicHeader. */
export default function TacGiaLoading() {
  return <PageSkeleton tone="candidate" cards={2} chrome="public" />;
}
